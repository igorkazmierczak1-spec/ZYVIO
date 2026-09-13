import { Router, type IRouter } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { stripeRequest } from "../stripeClient";
import { currentUserFrom, requireAuthenticatedUser } from "../middlewares/auth";
import { getRevenueCatAccess, hasRevenueCatConfig, type RevenueCatAccess } from "../revenueCatClient";
import { getUserPlan } from "../lib/premium";
import { PLAN_CONFIG } from "../lib/planConfig";

type PaidPlan = "PREMIUM" | "PREMIUM_PRO";
type BillingPeriod = "MONTHLY" | "YEARLY";

const router: IRouter = Router();

class CheckoutConflictError extends Error {}

function planFromMetadata(price: Record<string, unknown>): PaidPlan | null {
  const plan = (price.metadata as Record<string, string> | undefined)?.vybe_plan;
  if (plan === "premium_pro") return "PREMIUM_PRO";
  if (plan === "premium") return "PREMIUM";
  return null;
}

function planFromPrice(price: Record<string, unknown>): PaidPlan | null {
  const id = typeof price.id === "string" ? price.id : undefined;
  if (id === process.env.STRIPE_PREMIUM_PRO_MONTHLY_PRICE_ID || id === process.env.STRIPE_PREMIUM_PRO_YEARLY_PRICE_ID) {
    return "PREMIUM_PRO";
  }
  if (id === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || id === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID) {
    return "PREMIUM";
  }
  return planFromMetadata(price);
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
  const catalogMatch = (price: Record<string, unknown>) => planFromPrice(price) === plan && periodFromPrice(price) === period;
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

async function updateLocalRevenueCatSubscription(profileId: string, access: RevenueCatAccess) {
  await db.update(profilesTable).set({
    plan: access.plan,
    subscriptionStatus: access.status,
    billingPeriod: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
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
        const plan = planFromPrice(price) ?? (productPlan === "premium_pro" ? "PREMIUM_PRO" : "PREMIUM");
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
    res.json({ plans, benefits: Object.values(PLAN_CONFIG) });
  } catch (error) {
    next(error);
  }
});

router.get("/premium/benefits", requireAuthenticatedUser, async (_req, res, next): Promise<void> => {
  try {
    const currentPlan = await getUserPlan(currentUserFrom(res).id);
    res.json({
      currentPlan,
      plans: Object.values(PLAN_CONFIG),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/premium/subscription", requireAuthenticatedUser, async (_req, res, next): Promise<void> => {
  try {
    const user = currentUserFrom(res);
    const revenueCat = hasRevenueCatConfig() ? await getRevenueCatAccess(user.id) : null;
    if (revenueCat?.status === "active") {
      await updateLocalRevenueCatSubscription(user.id, revenueCat);
      res.json({
        subscription: {
          provider: "revenuecat",
          appUserId: revenueCat.appUserId,
          status: revenueCat.status,
          entitlements: revenueCat.entitlements,
          plan: revenueCat.plan,
        },
        plan: revenueCat.plan,
      });
      return;
    }
    const result = user.stripeCustomerId
      ? await stripeRequest<{ data: Array<Record<string, unknown>> }>(`subscriptions?customer=${encodeURIComponent(user.stripeCustomerId)}&status=all&limit=10`)
      : { data: [] };
    const subscription = activeSubscription(result.data ?? []) ?? result.data?.[0] ?? null;
    const item = ((subscription?.items as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined)?.[0];
    const price = item?.price as Record<string, unknown> | undefined;
     const plan = price ? planFromPrice(price) : null;
    if (subscription) await updateLocalSubscription(user.id, subscription, plan ?? "FREE");
    else if (revenueCat?.found) await updateLocalRevenueCatSubscription(user.id, revenueCat);
    res.json({
      subscription: subscription
        ? { ...subscription, plan }
        : revenueCat?.found
          ? { provider: "revenuecat", appUserId: revenueCat.appUserId, status: revenueCat.status, entitlements: revenueCat.entitlements, plan: "FREE" }
          : null,
      plan: plan ?? (revenueCat?.found ? "FREE" : user.plan ?? "FREE"),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/premium/revenuecat/sync", requireAuthenticatedUser, async (_req, res, next): Promise<void> => {
  try {
    if (!hasRevenueCatConfig()) {
      res.status(503).json({ error: "RevenueCat is not configured on the server" });
      return;
    }
    const user = currentUserFrom(res);
    const access = await getRevenueCatAccess(user.id);
    if (!access) {
      res.json({
        subscription: null,
        plan: "FREE",
        synced: false,
      });
      return;
    }
    await updateLocalRevenueCatSubscription(user.id, access);
    res.json({
      subscription: {
        provider: "revenuecat",
        appUserId: access.appUserId,
        status: access.status,
        entitlements: access.entitlements,
        plan: access.plan,
      },
      plan: access.plan,
      synced: true,
    });
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
    const price = await findPrice(plan, period);
    if (!price?.id) {
      res.status(503).json({ error: `${plan} ${period} price is not configured in Stripe` });
      return;
    }
    const base = `${req.protocol}://${req.get("host")}`;
    const session = await db.transaction(async (tx) => {
      // The lock covers customer resolution, the active-subscription check, and
      // the open-session lookup so concurrent checkout clicks cannot create
      // duplicate Stripe customers or sessions for the same profile.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vybe-checkout:${user.id}`}))`);
      const [lockedProfile] = await tx.select().from(profilesTable).where(eq(profilesTable.id, user.id));
      if (!lockedProfile) throw new Error("Profile not found");

      let customerId = lockedProfile.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeRequest<{ id: string }>("customers", "POST", {
          email: lockedProfile.email,
          "metadata[vybeUserId]": lockedProfile.id,
        });
        customerId = customer.id;
        await tx.update(profilesTable).set({ stripeCustomerId: customerId }).where(eq(profilesTable.id, lockedProfile.id));
      } else {
        const customer = await stripeRequest<Record<string, unknown>>(`customers/${encodeURIComponent(customerId)}`);
        const metadata = customer.metadata as Record<string, unknown> | undefined;
        const customerUserId = typeof metadata?.vybeUserId === "string" ? metadata.vybeUserId : undefined;
        const customerEmail = typeof customer.email === "string" ? customer.email.toLowerCase() : undefined;
        if ((customerUserId && customerUserId !== lockedProfile.id) ||
          (!customerUserId && customerEmail && customerEmail !== lockedProfile.email.toLowerCase())) {
          throw new Error("Stripe customer does not belong to this profile");
        }
        if (!customerUserId) {
          await stripeRequest(`customers/${encodeURIComponent(customerId)}`, "POST", {
            "metadata[vybeUserId]": lockedProfile.id,
          });
        }
      }

      const existing = await stripeRequest<{ data: Array<Record<string, unknown>> }>(`subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`);
      if (activeSubscription(existing.data ?? [])) {
        throw new CheckoutConflictError("An active subscription already exists");
      }

      const openSessions = await stripeRequest<{ data: Array<Record<string, unknown>> }>(
        `checkout/sessions?customer=${encodeURIComponent(customerId)}&status=open&limit=10`,
      );
      const reusableSession = (openSessions.data ?? []).find((candidate) => {
        const metadata = candidate.metadata as Record<string, unknown> | undefined;
        return metadata?.vybeUserId === lockedProfile.id && metadata?.vybePlan === plan &&
          typeof candidate.url === "string";
      });
      if (reusableSession?.url) return { url: reusableSession.url };

      return stripeRequest<{ url: string }>("checkout/sessions", "POST", {
        customer: customerId,
        mode: "subscription",
        "line_items[0][price]": String(price.id),
        "line_items[0][quantity]": 1,
        success_url: `${base}/premium?checkout=success&plan=${plan}`,
        cancel_url: `${base}/premium?checkout=cancel&plan=${plan}`,
        "metadata[vybeUserId]": lockedProfile.id,
        "metadata[vybePlan]": plan,
        "subscription_data[metadata][vybeUserId]": lockedProfile.id,
        "subscription_data[metadata][vybePlan]": plan,
      });
    });
    res.json({ url: session.url, plan, billingPeriod: period });
  } catch (error) {
    if (error instanceof CheckoutConflictError) {
      res.status(409).json({ error: "An active subscription already exists. Use subscription management to change plans." });
      return;
    }
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