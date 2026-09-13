import { and, count, eq, gte } from "drizzle-orm";
import {
  battleParticipantsTable,
  battlesTable,
  commentsTable,
  db,
  postsTable,
  votesTable,
} from "@workspace/db";
import type { Response } from "express";
import type { VybePlan } from "./premium";
import { planLimitFor, type PlanResource } from "./planConfig";

export class PlanQuotaError extends Error {
  readonly plan: VybePlan;
  readonly resource: PlanResource;
  readonly used: number;
  readonly limit: number;

  constructor(plan: VybePlan, resource: PlanResource, used: number, limit: number) {
    super(`Daily ${resource} limit reached for ${plan}`);
    this.name = "PlanQuotaError";
    this.plan = plan;
    this.resource = resource;
    this.used = used;
    this.limit = limit;
  }
}

function dayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function assertDailyPlanQuota(
  profileId: string,
  plan: VybePlan,
  resource: PlanResource,
) {
  const limit = planLimitFor(plan, resource);
  const since = dayStart();
  let used = 0;

  if (resource === "battleCreate") {
    const [row] = await db
      .select({ total: count() })
      .from(battlesTable)
      .where(and(eq(battlesTable.creatorProfileId, profileId), gte(battlesTable.createdAt, since)));
    used = Number(row?.total ?? 0);
  } else if (resource === "battleJoin") {
    const [row] = await db
      .select({ total: count() })
      .from(battleParticipantsTable)
      .where(and(eq(battleParticipantsTable.profileId, profileId), gte(battleParticipantsTable.joinedAt, since)));
    used = Number(row?.total ?? 0);
  } else if (resource === "battleVote") {
    const [row] = await db
      .select({ total: count() })
      .from(votesTable)
      .where(and(eq(votesTable.voterProfileId, profileId), gte(votesTable.createdAt, since)));
    used = Number(row?.total ?? 0);
  } else if (resource === "postCreate") {
    const [row] = await db
      .select({ total: count() })
      .from(postsTable)
      .where(and(eq(postsTable.authorProfileId, profileId), gte(postsTable.createdAt, since)));
    used = Number(row?.total ?? 0);
  } else {
    const [row] = await db
      .select({ total: count() })
      .from(commentsTable)
      .where(and(eq(commentsTable.authorProfileId, profileId), gte(commentsTable.createdAt, since)));
    used = Number(row?.total ?? 0);
  }

  if (used >= limit) throw new PlanQuotaError(plan, resource, used, limit);
  return { used, limit, remaining: limit - used };
}

export function sendPlanQuotaError(error: unknown, res: Response) {
  if (!(error instanceof PlanQuotaError)) return false;
  res.status(429).json({
    error: "Dzienny limit planu został osiągnięty",
    code: "PLAN_DAILY_LIMIT",
    plan: error.plan,
    resource: error.resource,
    used: error.used,
    limit: error.limit,
  });
  return true;
}