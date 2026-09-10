import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, hasDirectStripeCredentials } from "./stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe(): Promise<void> {
  if (!process.env.DATABASE_URL) { logger.warn("Stripe disabled: DATABASE_URL unavailable"); return; }
  if (!hasDirectStripeCredentials()) { logger.info("Stripe connector mode enabled; sync worker disabled"); return; }
  try {
    await runMigrations({ databaseUrl: process.env.DATABASE_URL });
    const sync = await getStripeSync();
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) await sync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
    await sync.syncBackfill();
    logger.info("Stripe sync ready");
  } catch (error) { logger.warn({ err: error }, "Stripe initialization unavailable"); }
}

await initStripe();
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
