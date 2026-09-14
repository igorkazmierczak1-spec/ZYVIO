import Stripe from "stripe";
import { db, profilesTable, stripeWebhookEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { stripeRequest } from "./stripeClient";

type Plan = "FREE" | "PREMIUM" | "PREMIUM_PRO";
type DatabaseExecutor = Pick<typeof db, "select" | "update">;

export class WebhookSignatureError extends Error {
  readonly statusCode = 400;
}

function planFromPrice(price: any): Plan {
  const id = typeof price === "string" ? price : price?.id;
  if (id && (id === process.env.STRIPE_PREMIUM_PRO_MONTHLY_PRICE_ID || id === process.env.STRIPE_PREMIUM_PRO_YEARLY_PRICE_ID)) return "PREMIUM_PRO";
  if (id && (id === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || id === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID)) return "PREMIUM";
  if (price?.metadata?.vybe_plan === "premium_pro") return "PREMIUM_PRO";
  if (price?.metadata?.vybe_plan === "premium") return "PREMIUM";
  return "FREE";
}

function periodFromPrice(price: any) {
  if (price?.metadata?.billing_period === "YEARLY" || price?.recurring?.interval === "year") return "YEARLY";
  return "MONTHLY";
}

async function findProfile(executor: DatabaseExecutor, customerId: string | null | undefined, userId?: string | null) {
  if (userId) {
    const [byUser] = await executor.select().from(profilesTable).where(eq(profilesTable.id, userId));
    if (byUser) {
      if (customerId && byUser.stripeCustomerId && byUser.stripeCustomerId !== customerId) return undefined;
      return byUser;
    }
  }
  if (customerId) {
    const [byCustomer] = await executor.select().from(profilesTable).where(eq(profilesTable.stripeCustomerId, customerId));
    if (byCustomer && userId && byCustomer.id !== userId) return undefined;
    return byCustomer;
  }
  return undefined;
}

async function syncSubscription(
  executor: DatabaseExecutor,
  subscription: any,
  fallbackUserId?: string | null,
  statusOverride?: string,
) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const plan = planFromPrice(price);
  const profile = await findProfile(executor, customerId, fallbackUserId);
  if (!profile) return;
  const status = statusOverride ?? String(subscription.status ?? "unknown");
  const active = ["active", "trialing"].includes(status);
  await executor.update(profilesTable).set({
    stripeCustomerId: customerId ?? profile.stripeCustomerId,
    stripeSubscriptionId: subscription.id ?? profile.stripeSubscriptionId,
    stripePriceId: price?.id ?? profile.stripePriceId,
    plan: active ? plan : "FREE",
    subscriptionStatus: status,
    billingPeriod: price ? periodFromPrice(price) : profile.billingPeriod,
    currentPeriodStart: Number(subscription.current_period_start ?? 0) || null,
    currentPeriodEnd: Number(subscription.current_period_end ?? 0) || null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  }).where(eq(profilesTable.id, profile.id));
}

function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Stripe webhook is not configured");
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      throw new WebhookSignatureError(error instanceof Error ? error.message : "Invalid Stripe webhook");
    }

    // The transaction-scoped advisory lock makes a duplicate wait for the
    // first delivery to finish instead of observing its optimistic insert.
    // This is intentionally keyed by the Stripe event ID, not the event type.
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.id}, 0))`);
      await tx.insert(stripeWebhookEventsTable)
        .values({ id: event.id, type: event.type, status: "pending" })
        .onConflictDoNothing();

      const [stored] = await tx
        .select()
        .from(stripeWebhookEventsTable)
        .where(eq(stripeWebhookEventsTable.id, event.id));
      if (!stored) throw new Error("Stripe webhook event could not be recorded");
      if (stored.status === "processed") return { processed: true };

      const now = new Date();
      await tx.update(stripeWebhookEventsTable).set({
        status: "pending",
        attemptCount: sql`${stripeWebhookEventsTable.attemptCount} + 1`,
        lastAttemptAt: now,
        failedAt: null,
        errorSummary: null,
        updatedAt: now,
      }).where(eq(stripeWebhookEventsTable.id, event.id));

      try {
        const data: any = event.data.object;
        if (event.type === "checkout.session.completed") {
          const userId = data.metadata?.vybeUserId ?? data.subscription_details?.metadata?.vybeUserId;
          if (data.subscription) {
            const subscription = await stripeRequest<any>(`subscriptions/${String(data.subscription)}`);
            await syncSubscription(tx, subscription, userId);
          }
        } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
          await syncSubscription(tx, data, data.metadata?.vybeUserId);
        } else if (event.type === "customer.subscription.deleted") {
          await syncSubscription(tx, data, data.metadata?.vybeUserId, "canceled");
        } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
          const subscriptionId = typeof data.subscription === "string" ? data.subscription : data.subscription?.id;
          if (subscriptionId) {
            const subscription = await stripeRequest<any>(`subscriptions/${subscriptionId}`);
            await syncSubscription(tx, subscription, undefined, event.type === "invoice.payment_failed" ? "past_due" : undefined);
          }
        }
        const processedAt = new Date();
        await tx.update(stripeWebhookEventsTable).set({
          status: "processed",
          processedAt,
          failedAt: null,
          errorSummary: null,
          updatedAt: processedAt,
        }).where(eq(stripeWebhookEventsTable.id, event.id));
        return { processed: true };
      } catch (error) {
        // Commit the failure state before rethrowing outside the transaction.
        // The next Stripe delivery can then retry this event, while a
        // concurrent delivery waits on the advisory lock and sees this state.
        const failedAt = new Date();
        await tx.update(stripeWebhookEventsTable).set({
          status: "failed",
          processedAt: null,
          failedAt,
          errorSummary: errorSummary(error),
          updatedAt: failedAt,
        }).where(eq(stripeWebhookEventsTable.id, event.id));
        return { processed: false, error };
      }
    });

    if (!result.processed) {
      throw result.error;
    }
  }
}