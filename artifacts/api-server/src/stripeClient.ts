import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { ReplitConnectors } from "@replit/connectors-sdk";

export function hasDirectStripeCredentials(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  if (process.env.STRIPE_SECRET_KEY) return { secretKey: process.env.STRIPE_SECRET_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
  throw new Error("Direct Stripe credentials are not configured");
  /*
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : undefined;
  if (!hostname || !token) throw new Error("Stripe integration is not connected");
  const response = await fetch(`https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`, {
    headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Stripe credentials unavailable (${response.status})`);
  const data = await response.json() as { items?: Array<{ settings?: { secret_key?: string; webhook_secret?: string } }> };
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret_key) throw new Error("Stripe secret key is unavailable");
  return { secretKey: settings.secret_key, webhookSecret: settings.webhook_secret };
  */
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const credentials = await getStripeCredentials();
  return new StripeSync({
    poolConfig: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
    },
    stripeSecretKey: credentials.secretKey,
    stripeWebhookSecret: credentials.webhookSecret ?? "",
  });
}

export async function stripeRequest<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) body.set(key, String(value));
  let response: Response;
  if (hasDirectStripeCredentials()) {
    response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\/v1\//, "").replace(/^\//, "")}`, {
      method,
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: method === "GET" ? undefined : body.toString(),
    });
  } else {
    response = await new ReplitConnectors().proxy("stripe", `/v1/${path.replace(/^\/v1\//, "").replace(/^\//, "")}`, {
      method,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: method === "GET" ? undefined : body.toString(),
    });
  }
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `Stripe request failed (${response.status})`);
  return data;
}