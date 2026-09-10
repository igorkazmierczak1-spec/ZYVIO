import { Router, type IRouter } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { stripeRequest } from "../stripeClient";
import { currentUserFrom, requireAuthenticatedUser } from "../middlewares/auth";

const router: IRouter = Router();
router.get("/premium/plans", async (_req, res, next): Promise<void> => {
  try {
    const products = await stripeRequest<{ data: Array<Record<string, unknown>> }>("products?active=true&limit=100");
    const plans: Record<string, unknown>[] = [];
    for (const product of products.data ?? []) {
      if ((product.metadata as Record<string, string> | undefined)?.vybe_plan !== "premium") continue;
      const prices = await stripeRequest<{ data: Array<Record<string, unknown>> }>(`prices?active=true&product=${product.id}&limit=100`);
      for (const price of prices.data ?? []) plans.push({ product_id: product.id, name: product.name, description: product.description ?? null, price_id: price.id, unit_amount: price.unit_amount ?? null, currency: price.currency, recurring: price.recurring ?? null, metadata: price.metadata ?? {} });
    }
    res.json({ plans });
  } catch (error) { next(error); }
});
router.get("/premium/subscription", requireAuthenticatedUser, async (_req, res, next): Promise<void> => {
  try {
    const user = currentUserFrom(res);
    const result = user.stripeCustomerId ? await stripeRequest<{ data: unknown[] }>(`subscriptions?customer=${user.stripeCustomerId}&limit=1`) : { data: [] };
    res.json({ subscription: result.data[0] ?? null });
  } catch (error) { next(error); }
});
router.post("/premium/checkout", requireAuthenticatedUser, async (req, res, next): Promise<void> => {
  try {
    const period = req.body?.billingPeriod;
    if (period !== "MONTHLY" && period !== "YEARLY") { res.status(400).json({ error: "billingPeriod must be MONTHLY or YEARLY" }); return; }
    const user = currentUserFrom(res);
    const plans = await stripeRequest<{ data: Array<Record<string, unknown>> }>("prices?active=true&limit=100");
    const priceId = plans.data.find((price) => (price.metadata as Record<string, string> | undefined)?.vybe_plan === "premium" && (price.metadata as Record<string, string> | undefined)?.billing_period === period)?.id as string | undefined;
    if (!priceId) { res.status(503).json({ error: "Premium plan is not configured" }); return; }
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>("customers", "POST", { email: user.email, "metadata[vybeUserId]": user.id });
      customerId = customer.id;
      await db.update(profilesTable).set({ stripeCustomerId: customerId }).where(eq(profilesTable.id, user.id));
    }
    const base = `${req.protocol}://${req.get("host")}`;
    const session = await stripeRequest<{ url: string }>("checkout/sessions", "POST", { customer: customerId, mode: "subscription", "line_items[0][price]": priceId, "line_items[0][quantity]": 1, success_url: `${base}/premium?checkout=success`, cancel_url: `${base}/premium?checkout=cancel`, "metadata[vybeUserId]": user.id });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});
router.post("/premium/portal", requireAuthenticatedUser, async (req, res, next): Promise<void> => {
  try {
    const user = currentUserFrom(res);
    if (!user.stripeCustomerId) { res.status(400).json({ error: "No Stripe customer exists" }); return; }
    const session = await stripeRequest<{ url: string }>("billing_portal/sessions", "POST", { customer: user.stripeCustomerId, return_url: `${req.protocol}://${req.get("host")}/premium` });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});
export default router;