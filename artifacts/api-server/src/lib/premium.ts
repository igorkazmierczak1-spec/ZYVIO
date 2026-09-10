import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function hasPremiumAccess(stripeCustomerId: string | null): Promise<boolean> {
  if (!stripeCustomerId) return false;
  const result = await db.execute(sql`SELECT 1 FROM stripe.subscriptions WHERE customer = ${stripeCustomerId} AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > extract(epoch from now())) LIMIT 1`);
  return result.rows.length > 0;
}

export function requirePremium(): import("express").RequestHandler {
  return async (_req, res, next) => {
    try {
      const profile = res.locals.currentUser;
      if (!profile || !(await hasPremiumAccess(profile.stripeCustomerId))) {
        res.status(403).json({ error: "Premium subscription required" });
        return;
      }
      next();
    } catch (error) { next(error); }
  };
}