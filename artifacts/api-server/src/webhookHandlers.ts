import Stripe from "stripe";
import { db, profilesTable, stripeWebhookEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient";

type Plan = "FREE" | "PREMIUM" | "PREMIUM_PRO";

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

async function findProfile(customerId: string | null | undefined, userId?: string | null) {
  if (userId) {
    const [byUser] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    if (byUser) return byUser;
  }
  if (customerId) {
    const [byCustomer] = await db.select().from(profilesTable).where(eq(profilesTable.stripeCustomerId, customerId));
    return byCustomer;
  }
  return undefined;
}

async function syncSubscription(subscription: any, fallbackUserId?: string | null, statusOverride?: string) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const plan = planFromPrice(price);
  const profile = await findProfile(customerId, fallbackUserId);
  if (!profile) return;
  const status = statusOverride ?? String(subscription.status ?? "unknown");
  const active = ["active", "trialing", "past_due"].includes(status);
  await db.update(profilesTable).set({
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

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Stripe webhook is not configured");
    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    const [inserted] = await db.insert(stripeWebhookEventsTable)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeWebhookEventsTable.id });
    if (!inserted) return;

    const data: any = event.data.object;
    if (event.type === "checkout.session.completed") {
      const userId = data.metadata?.vybeUserId ?? data.subscription_details?.metadata?.vybeUserId;
      if (data.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(data.subscription));
        await syncSubscription(subscription, userId);
      }
      return;
    }
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      await syncSubscription(data, data.metadata?.vybeUserId);
      return;
    }
    if (event.type === "customer.subscription.deleted") {
      await syncSubscription(data, data.metadata?.vybeUserId, "canceled");
      return;
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const subscriptionId = typeof data.subscription === "string" ? data.subscription : data.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription, undefined, event.type === "invoice.payment_failed" ? "past_due" : undefined);
      }
    }
  }
}