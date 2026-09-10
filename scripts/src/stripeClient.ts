import Stripe from "stripe";
import { ReplitConnectors } from "@replit/connectors-sdk";

async function credentials(): Promise<{ secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPLIT_IDENTITY ? `repl ${process.env.REPLIT_IDENTITY}` : process.env.WEB_REPL_RENEWAL ? `depl ${process.env.WEB_REPL_RENEWAL}` : undefined;
  if (!hostname || !token) throw new Error("Stripe integration is not connected");
  const response = await fetch(`https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`, { headers: { Accept: "application/json", X_REPLIT_TOKEN: token } });
  if (!response.ok) throw new Error(`Stripe credentials unavailable (${response.status})`);
  const data = await response.json() as { items?: Array<{ settings?: { secret_key?: string } }> };
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret_key) throw new Error("Stripe secret key is unavailable");
  return { secretKey: settings.secret_key };
}
export async function getUncachableStripeClient(): Promise<Stripe> {
  if (process.env.STRIPE_SECRET_KEY) return new Stripe(process.env.STRIPE_SECRET_KEY);
  return new Stripe("sk_connector_placeholder");
}

export async function stripeRequest<T = Record<string, unknown>>(path: string, method = "GET", params: Record<string, string | number | undefined> = {}): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) body.set(key, String(value));
  const response = process.env.STRIPE_SECRET_KEY
    ? await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: method === "GET" ? undefined : body.toString() })
    : await new ReplitConnectors().proxy("stripe", `/v1/${path}`, { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: method === "GET" ? undefined : body.toString() });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `Stripe request failed (${response.status})`);
  return data;
}