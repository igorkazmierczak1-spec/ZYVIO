import { and, count, eq, gte, sql } from "drizzle-orm";
import { aiUsageTable, db } from "@workspace/db";
import type { VybePlan } from "./premium";

const AI_USAGE_LIMITS: Record<VybePlan, number> = {
  FREE: 3,
  PREMIUM: 30,
  PREMIUM_PRO: 100,
};

export class AiUsageLimitError extends Error {
  readonly plan: VybePlan;
  readonly used: number;
  readonly limit: number;

  constructor(plan: VybePlan, used: number) {
    const limit = AI_USAGE_LIMITS[plan];
    super(`Daily AI usage limit reached for ${plan}`);
    this.name = "AiUsageLimitError";
    this.plan = plan;
    this.used = used;
    this.limit = limit;
  }
}

function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function aiUsageLimitFor(plan: VybePlan) {
  return AI_USAGE_LIMITS[plan];
}

export async function reserveAiUsage(input: {
  profileId: string;
  plan: VybePlan;
  feature: string;
  promptCharacters: number;
}) {
  const dayStart = utcDayStart();
  return db.transaction(async (tx) => {
    // Serialize reservations for one profile/feature/day so concurrent requests
    // cannot both pass the count check.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.profileId}:${input.feature}:${dayStart.toISOString()}`}))`,
    );
    const [usage] = await tx
      .select({ total: count() })
      .from(aiUsageTable)
      .where(
        and(
          eq(aiUsageTable.profileId, input.profileId),
          eq(aiUsageTable.feature, input.feature),
          gte(aiUsageTable.createdAt, dayStart),
        ),
      );
    const used = Number(usage?.total ?? 0);
    if (used >= aiUsageLimitFor(input.plan)) {
      throw new AiUsageLimitError(input.plan, used);
    }
    const [reservation] = await tx
      .insert(aiUsageTable)
      .values({
        id: `ai-usage-${crypto.randomUUID()}`,
        profileId: input.profileId,
        feature: input.feature,
        plan: input.plan,
        status: "reserved",
        promptCharacters: input.promptCharacters,
      })
      .returning();
    return reservation;
  });
}

export async function completeAiUsage(id: string, status: "success" | "provider_error") {
  await db
    .update(aiUsageTable)
    .set({ status })
    .where(eq(aiUsageTable.id, id));
}