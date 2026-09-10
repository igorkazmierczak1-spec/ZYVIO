import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type VybePlan = "FREE" | "PREMIUM" | "PREMIUM_PRO";

export async function getUserPlan(userId: string): Promise<VybePlan> {
  const [profile] = await db.select({ plan: profilesTable.plan, subscriptionStatus: profilesTable.subscriptionStatus }).from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile || !["active", "trialing", "past_due"].includes(profile.subscriptionStatus)) return "FREE";
  return profile.plan === "PREMIUM_PRO" ? "PREMIUM_PRO" : profile.plan === "PREMIUM" ? "PREMIUM" : "FREE";
}

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return plan === "PREMIUM" || plan === "PREMIUM_PRO";
}

export async function hasPremiumProAccess(userId: string): Promise<boolean> {
  return (await getUserPlan(userId)) === "PREMIUM_PRO";
}

export function requirePremium(): import("express").RequestHandler {
  return async (_req, res, next) => {
    try {
      const profile = res.locals.currentUser;
      if (!profile || !(await hasPremiumAccess(profile.id))) {
        res.status(403).json({ error: "Premium subscription required" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePremiumPro(): import("express").RequestHandler {
  return async (_req, res, next) => {
    try {
      const profile = res.locals.currentUser;
      if (!profile || !(await hasPremiumProAccess(profile.id))) {
        res.status(403).json({ error: "Premium Pro subscription required" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}