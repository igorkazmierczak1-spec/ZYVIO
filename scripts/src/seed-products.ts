import { stripeRequest } from "./stripeClient";

type Row = Record<string, any>;

async function ensurePlan(plan: "premium" | "premium_pro", name: string, monthly: number, yearly: number) {
  const products = await stripeRequest<{ data: Row[] }>("products?active=true&limit=100");
  const product = products.data.find((p) => p.metadata?.vybe_plan === plan)
    ?? await stripeRequest<Row>("products", "POST", {
      name,
      description: `${name} membership for VYBE`,
      "metadata[vybe_plan]": plan,
    });
  const prices = await stripeRequest<{ data: Row[] }>(`prices?product=${product.id}&active=true&limit=100`);
  const wanted = [
    { amount: monthly, interval: "month", period: "MONTHLY" },
    { amount: yearly, interval: "year", period: "YEARLY" },
  ];
  for (const price of wanted) {
    const exists = prices.data.some((p) =>
      Number(p.unit_amount) === price.amount
      && p.currency === "pln"
      && p.recurring?.interval === price.interval
      && p.metadata?.vybe_plan === plan
      && p.metadata?.billing_period === price.period,
    );
    if (!exists) {
      await stripeRequest("prices", "POST", {
        product: String(product.id),
        unit_amount: price.amount,
        currency: "pln",
        "recurring[interval]": price.interval,
        "metadata[vybe_plan]": plan,
        "metadata[billing_period]": price.period,
      });
    }
  }
  const refreshed = await stripeRequest<{ data: Row[] }>(`prices?product=${product.id}&active=true&limit=100`);
  const selected = refreshed.data.filter((p) => p.metadata?.vybe_plan === plan);
  console.log(`${name}: ${selected.map((p) => `${p.metadata.billing_period}=${p.id}`).join(" ")}`);
}

await ensurePlan("premium", "VYBE PREMIUM", 1999, 14999);
await ensurePlan("premium_pro", "VYBE PREMIUM PRO", 3999, 29999);
console.log("VYBE billing catalog ready (connector/direct Stripe mode)");