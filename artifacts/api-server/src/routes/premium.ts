import { Router, type IRouter } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { stripeRequest } from "../stripeClient";
import { currentUserFrom, requireAuthenticatedUser } from "../middlewares/auth";

type PaidPlan = "PREMIUM" | "PREMIUM_PRO";
type BillingPeriod = "MONTHLY" | "YEARLY";

const router: IRouter = Router();

function planFromMetadata(price: Record<string, unknown>): PaidPlan | null {
  const plan = (price.metadata as Record<string, string> | undefined)?.vybe_plan;
  if (plan === "premium_pro") return "PREMIUM_PRO";
  if (plan === "premium") return "PREMIUM";
  return null;
}

function periodFromPrice(price: Record<string, unknown>): BillingPeriod | null {
  const period = (price.metadata as Record<string, string> | undefined)?.billing_period;
  if (period === "MONTHLY" || period === "YEARLY") return period;
  return (price.recurring as Record<string, unknown> | undefined)?.interval === "year" ? "YEARLY" : "MONTHLY";
}

function configuredPriceId(plan: PaidPlan, period: BillingPeriod): string | undefined {
  const key = plan === "PREMIUM_PRO"
    ? period === "MONTHLY" ? "STRIPE_PREMIUM_PRO_MONTHLY_PRICE_ID" : "STRIPE_PREMIUM_PRO_YEARLY_PRICE_ID"
    : period === "MONTHLY" ? "STRIPE_PREMIUM_MONTHLY_PRICE_ID" : "STRIPE_PREMIUM_YEARLY_PRICE_ID";
  return process.env[key];
}

async function listPaidPrices() {
  const result = await stripeRequest<{ data: Array<Record<string, unknown>> }>("prices?active=true&limit=100");
  return result.data ?? [];
}

async function findPrice(plan: PaidPlan, period: BillingPeriod) {
  const prices = await listPaidPrices();
  const configuredId = configuredPriceId(plan, period);
  const catalogMatch = (price: Record<string, unknown>) => planFromMetadata(price) === plan && periodFromPrice(price) === period;
  // A configured Price ID is preferred, but the Stripe catalog metadata remains
  // a safe server-side fallback if a Replit Secret was copied before the price
  // was created or contains an outdated value. The client never supplies this ID.
  return prices.find((price) => configuredId && price.id === configuredId && catalogMatch(price))
    ?? prices.find(catalogMatch);
}

function activeSubscription(rows: Array<Record<string, unknown>>) {
  return rows.find((row) => row.status === "active" || row.status === "trialing" || row.status === "past_due");
}

async function updateLocalSubscription(profileId: string, subscription: Record<string, unknown> | null, plan: PaidPlan | "FREE" = "FREE") {
  if (!subscription) {
    await db.update(profilesTable).set({
      plan: "FREE",
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: "inactive",
      billingPeriod: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }).where(eq(profilesTable.id, profileId));
    return;
  }
  const item = ((subscription.items as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined)?.[0];
  const price = item?.price as Record<string, unknown> | undefined;
  await db.update(profilesTable).set({
    plan,
    stripeSubscriptionId: String(subscription.id ?? ""),
    stripePriceId: price?.id ? String(price.id) : null,
    subscriptionStatus: String(subscription.status ?? "unknown"),
    billingPeriod: price ? periodFromPrice(price) : null,
    currentPeriodStart: Number(subscription.current_period_start ?? 0) || null,
    currentPeriodEnd: Number(subscription.current_period_end ?? 0) || null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  }).where(eq(profilesTable.id, profileId));
}

router.get("/premium/plans", async (_req, res, next): Promise<void> => {
  try {
    const products = await stripeRequest<{ data: Array<Record<string, unknown>> }>("products?active=true&limit=100");
    const plans: Record<string, unknown>[] = [];
    for (const product of products.data ?? []) {
      const productPlan = (product.metadata as Record<string, string> | undefined)?.vybe_plan;
      if (productPlan !== "premium" && productPlan !== "premium_pro") continue;
      const prices = await stripeRequest<{ data: Array<Record<string, unknown>> }>(`prices?active=true&product=${product.id}&limit=100`);
      for (const price of prices.data ?? []) {
        const plan = planFromMetadata(price) ?? (productPlan === "premium_pro" ? "PREMIUM_PRO" : "PREMIUM");
        const period = periodFromPrice(price);
        if (!period) continue;
        plans.push({
          plan,
          product_id: product.id,
          name: product.name,
          description: product.description ?? null,
          price_id: price.id,
          unit_amount: price.unit_amount ?? null,
          currency: price.currency,
          recurring: price.recurring ?? null,
          metadata: price.metadata ?? {},
        });
      }
    }
    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

router.get("/premium/subscription", requireAuthenticatedUser, async (_req, res, next): Promise<void> => {
  try {
    const user = currentUserFrom(res);
    const result = user.stripeCustomerId
      ? await stripeRequest<{ data: Array<Record<string, unknown>> }>(`subscriptions?customer=${encodeURIComponent(user.stripeCustomerId)}&status=all&limit=10`)
      : { data: [] };
    const subscription = activeSubscription(result.data ?? []) ?? result.data?.[0] ?? null;
    const item = ((subscription?.items as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined)?.[0];
    const price = item?.price as Record<string, unknown> | undefined;
    const plan = price ? planFromMetadata(price) : null;
    if (subscription && plan) await updateLocalSubscription(user.id, subscription, plan);
    res.json({ subscription: subscription ? { ...subscription, plan } : null, plan: plan ?? user.plan ?? "FREE" });
  } catch (error) {
    next(error);
  }
});

router.post("/premium/checkout", requireAuthenticatedUser, async (req, res, next): Promise<void> => {
  try {
    const period = req.body?.billingPeriod as BillingPeriod;
    const plan = (req.body?.plan ?? "PREMIUM") as PaidPlan;
    if (!["MONTHLY", "YEARLY"].includes(period) || !["PREMIUM", "PREMIUM_PRO"].includes(plan)) {
      res.status(400).json({ error: "A valid plan and billingPeriod are required" });
      return;
    }
    const user = currentUserFrom(res);
    if (user.stripeCustomerId) {
      const existing = await stripeRequest<{ data: Array<Record<string, unknown>> }>(`subscriptions?customer=${encodeURIComponent(user.stripeCustomerId)}&status=all&limit=10`);
      if (activeSubscription(existing.data ?? [])) {
        res.status(409).json({ error: "An active subscription already exists. Use subscription management to change plans." });
        return;
      }
    }
    const price = await findPrice(plan, period);
    if (!price?.id) {
      res.status(503).json({ error: `${plan} ${period} price is not configured in Stripe` });
      return;
    }
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>("customers", "POST", {
        email: user.email,
        "metadata[vybeUserId]": user.id,
      });
      customerId = customer.id;
      await db.update(profilesTable).set({ stripeCustomerId: customerId }).where(eq(profilesTable.id, user.id));
    }
    const base = `${req.protocol}://${req.get("host")}`;
    const session = await stripeRequest<{ url: string }>("checkout/sessions", "POST", {
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": String(price.id),
      "line_items[0][quantity]": 1,
      success_url: `${base}/premium?checkout=success&plan=${plan}`,
      cancel_url: `${base}/premium?checkout=cancel&plan=${plan}`,
      "metadata[vybeUserId]": user.id,
      "subscription_data[metadata][vybeUserId]": user.id,
      "subscription_data[metadata][vybePlan]": plan,
    });
    res.json({ url: session.url, plan, billingPeriod: period });
  } catch (error) {
    next(error);
  }
});

router.post("/premium/change-plan", requireAuthenticatedUser, async (req, res, next): Promise<void> => {
  try {
    const plan = req.body?.plan as PaidPlan;
    const period = req.body?.billingPeriod as BillingPeriod;
    if (!["PREMIUM", "PREMIUM_PRO"].includes(plan) || !["MONTHLY", "YEARLY"].includes(period)) {
      res.status(400).json({ error: "A valid plan and billingPeriod are required" });
      return;
    }
    const user = currentUserFrom(res);
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No active Stripe subscription exists" });
      return;
    }
    const subscriptions = await stripeRequest<{ data: Array<Record<string, unknown>> }>(`subscriptions?customer=${encodeURIComponent(user.stripeCustomerId)}&status=all&limit=10`);
    const current = activeSubscription(subscriptions.data ?? []);
    const item = ((current?.items as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined)?.[0];
    if (!current?.id || !item?.id) {
      res.status(400).json({ error: "No active Stripe subscription exists" });
      return;
    }
    const price = await findPrice(plan, period);
    if (!price?.id) {
      res.status(503).json({ error: `${plan} ${period} price is not configured in Stripe` });
      return;
    }
    const updated = await stripeRequest<Record<string, unknown>>(`subscriptions/${current.id}`, "POST", {
      "items[0][id]": String(item.id),
      "items[0][price]": String(price.id),
      proration_behavior: "create_prorations",
    });
    await updateLocalSubscription(user.id, updated, plan);
    res.json({ subscription: updated, plan, billingPeriod: period });
  } catch (error) {
    next(error);
  }
});

router.post("/premium/portal", requireAuthenticatedUser, async (req, res, next): Promise<void> => {
  try {
    const user = currentUserFrom(res);
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer exists" });
      return;
    }
    const session = await stripeRequest<{ url: string }>("billing_portal/sessions", "POST", {
      customer: user.stripeCustomerId,
      return_url: `${req.protocol}://${req.get("host")}/premium`,
    });
    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

export default router;