import { stripeRequest } from "./stripeClient";

const products = await stripeRequest<{ data: Array<Record<string, unknown>> }>("products?active=true&limit=100");
const product = products.data.find((p) => (p.metadata as Record<string, string> | undefined)?.vybe_plan === "premium") ??
  await stripeRequest<Record<string, string>>("products", "POST", { name: "VYBE PREMIUM", description: "Premium membership for VYBE", "metadata[vybe_plan]": "premium" });
const prices = await stripeRequest<{ data: Array<Record<string, unknown>> }>(`prices?product=${product.id}&active=true&limit=100`);
if (!prices.data.some((p) => p.unit_amount === 1999 && p.currency === "pln" && (p.recurring as Record<string, string> | undefined)?.interval === "month")) await stripeRequest("prices", "POST", { product: String(product.id), unit_amount: 1999, currency: "pln", "recurring[interval]": "month", "metadata[vybe_plan]": "premium", "metadata[billing_period]": "MONTHLY" });
if (!prices.data.some((p) => p.unit_amount === 14999 && p.currency === "pln" && (p.recurring as Record<string, string> | undefined)?.interval === "year")) await stripeRequest("prices", "POST", { product: String(product.id), unit_amount: 14999, currency: "pln", "recurring[interval]": "year", "metadata[vybe_plan]": "premium", "metadata[billing_period]": "YEARLY" });
console.log("VYBE PREMIUM catalog ready (connector/direct Stripe mode)");