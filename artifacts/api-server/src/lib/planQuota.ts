import { and, count, eq, gte, lt } from "drizzle-orm";
import {
  battlesTable,
  commentsTable,
  db,
  postsTable,
} from "@workspace/db";
import type { Response } from "express";
import type { VybePlan } from "./premium";
import { planLimitFor, type PlanResource } from "./planConfig";

export class PlanQuotaError extends Error {
  readonly plan: VybePlan;
  readonly resource: PlanResource;
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;

  constructor(plan: VybePlan, resource: PlanResource, used: number, limit: number) {
    super(
      plan === "PREMIUM_PRO"
        ? "Wykorzystałeś dzisiejszy limit Battle. Twój plan Premium Pro ma najwyższy dostępny limit Battle."
        : "Wykorzystałeś dzisiejszy limit Battle. Przejdź na Premium, aby tworzyć więcej Battle.",
    );
    this.name = "PlanQuotaError";
    this.plan = plan;
    this.resource = resource;
    this.used = used;
    this.limit = limit;
    this.remaining = Math.max(0, limit - used);
  }
}

export function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getDailyPlanQuota(
  profileId: string,
  plan: VybePlan,
  resource: PlanResource,
  now = new Date(),
) {
  const limit = planLimitFor(plan, resource);
  const since = utcDayStart(now);
  const until = new Date(since);
  until.setUTCDate(until.getUTCDate() + 1);
  let used = 0;

  if (resource === "battleCreate") {
    const [row] = await db
      .select({ total: count() })
      .from(battlesTable)
      .where(and(
        eq(battlesTable.creatorProfileId, profileId),
        gte(battlesTable.createdAt, since),
        lt(battlesTable.createdAt, until),
      ));
    used = Number(row?.total ?? 0);
  } else if (resource === "postCreate") {
    const [row] = await db
      .select({ total: count() })
      .from(postsTable)
      .where(and(
        eq(postsTable.authorProfileId, profileId),
        gte(postsTable.createdAt, since),
        lt(postsTable.createdAt, until),
      ));
    used = Number(row?.total ?? 0);
  } else {
    const [row] = await db
      .select({ total: count() })
      .from(commentsTable)
      .where(and(
        eq(commentsTable.authorProfileId, profileId),
        gte(commentsTable.createdAt, since),
        lt(commentsTable.createdAt, until),
      ));
    used = Number(row?.total ?? 0);
  }

  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function assertDailyPlanQuota(
  profileId: string,
  plan: VybePlan,
  resource: PlanResource,
) {
  const usage = await getDailyPlanQuota(profileId, plan, resource);
  if (usage.used >= usage.limit) {
    throw new PlanQuotaError(plan, resource, usage.used, usage.limit);
  }
  return usage;
}

export function sendPlanQuotaError(error: unknown, res: Response) {
  if (!(error instanceof PlanQuotaError)) return false;
  res.status(429).json({
    error: error.message,
    code: "PLAN_DAILY_LIMIT",
    plan: error.plan,
    resource: error.resource,
    used: error.used,
    limit: error.limit,
    remaining: error.remaining,
  });
  return true;
}