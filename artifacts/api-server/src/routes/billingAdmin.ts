import { Router, type IRouter } from "express";
import { hasDirectStripeCredentials, stripeRequest } from "../stripeClient";
import { requireAuthenticatedUser, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuthenticatedUser, requireAdmin);
const rangeSince = (range: string) => range === "all" ? new Date(0) : new Date(Date.now() - ({ "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5, "90d": 90 * 864e5 }[range] ?? 30 * 864e5));
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""').replaceAll(/\r?\n/g, " ")}"`;

router.get("/admin/billing/config", async (_req, res) => {
  try {
    const prices = await stripeRequest<{ data: Array<Record<string, unknown>> }>("prices?active=true&limit=100");
    const metadata = prices.data ?? [];
    res.json({ connected: true, provider: "stripe", currency: "pln", webhookConfigured: hasDirectStripeCredentials() && Boolean(process.env.STRIPE_WEBHOOK_SECRET), monthlyPriceConfigured: metadata.some((p) => (p.metadata as Record<string, string> | undefined)?.billing_period === "MONTHLY"), yearlyPriceConfigured: metadata.some((p) => (p.metadata as Record<string, string> | undefined)?.billing_period === "YEARLY"), syncMode: hasDirectStripeCredentials() ? "stripe-replit-sync" : "connector" });
  } catch (_error) {
    res.json({ connected: false, provider: "stripe", currency: "pln", webhookConfigured: false, monthlyPriceConfigured: false, yearlyPriceConfigured: false, syncMode: "unavailable" });
  }
});
router.get("/admin/billing/overview", async (req, res, next): Promise<void> => {
  try {
    const since = rangeSince(String(req.query.range ?? "30d"));
    const [subs, invoices, intents] = await Promise.all([
      stripeRequest<{ data: Array<Record<string, unknown>> }>("subscriptions?status=all&limit=100"),
      stripeRequest<{ data: Array<Record<string, unknown>> }>("invoices?limit=100"),
      stripeRequest<{ data: Array<Record<string, unknown>> }>("payment_intents?limit=100"),
    ]);
    const subscriptions = subs.data ?? [], invoiceRows = invoices.data ?? [], paymentRows = intents.data ?? [];
    const inRange = (row: Record<string, unknown>) => Number(row.created ?? 0) * 1000 >= since.getTime();
    const totalRevenue = invoiceRows.filter((row) => row.paid && inRange(row)).reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0);
    const active = subscriptions.filter((row) => row.status === "active" || row.status === "trialing").length;
    const monthly = invoiceRows.filter((row) => row.paid && row.billing_reason !== "subscription_create").reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0);
    res.json({ connected: true, range: String(req.query.range ?? "30d"), subscriptions: [{ status: "active", count: active }, { status: "canceled", count: subscriptions.filter((row) => row.status === "canceled").length }], revenue: totalRevenue, payments: paymentRows.filter((row) => row.status === "succeeded" && inRange(row)).length, totalRevenue, revenue30d: totalRevenue, mrr: monthly, arr: monthly * 12, activeSubscriptions: active, newSubscriptions: subscriptions.filter(inRange).length, cancelledSubscriptions: subscriptions.filter((row) => row.status === "canceled" && inRange(row)).length, successfulPayments: paymentRows.filter((row) => row.status === "succeeded" && inRange(row)).length, failedPayments: paymentRows.filter((row) => row.status === "failed" && inRange(row)).length, premiumCount: active, conversion: null, trend: [] });
  } catch (_error) { res.json({ connected: false, range: String(req.query.range ?? "30d"), subscriptions: [], revenue: null, payments: null }); }
});
router.get("/admin/billing/subscriptions", async (req, res, next): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1)), pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const search = String(req.query.search ?? ""), status = String(req.query.status ?? "");
    const result = await stripeRequest<{ data: Array<Record<string, unknown>> }>("subscriptions?status=all&limit=100");
    const items = (result.data ?? []).filter((row) => (!status || row.status === status) && (!search || String(row.id).includes(search) || String(row.customer).includes(search))).slice((page - 1) * pageSize, page * pageSize);
    res.json({ items, page, pageSize, total: result.data?.length ?? 0, totalPages: Math.ceil((result.data?.length ?? 0) / pageSize) });
  } catch (error) { next(error); }
});
router.get("/admin/billing/subscriptions.csv", async (_req, res, next): Promise<void> => {
  try {
    const result = await stripeRequest<{ data: Array<Record<string, unknown>> }>("subscriptions?status=all&limit=100");
    const headers = ["id", "customer", "email", "status", "current_period_end", "created"];
    res.type("text/csv").setHeader("Content-Disposition", "attachment; filename=subscriptions.csv");
    res.send([headers.join(","), ...(result.data ?? []).map((row) => headers.map((key) => csv(row[key])).join(","))].join("\n"));
  } catch (error) { next(error); }
});
export default router;