import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  activitiesTable,
  battleParticipantsTable,
  battleResultsTable,
  battlesTable,
  notificationsTable,
  profilesTable,
  votesTable,
  viralRewardEventsTable,
  db,
} from "@workspace/db";
import { planConfigFor } from "./lib/planConfig";

const XP_PER_LEVEL = 320;

export function levelForXp(xp: number) {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function xpProgress(xp: number) {
  const level = levelForXp(xp);
  const levelStart = (level - 1) * XP_PER_LEVEL;
  return {
    level,
    xpForNextLevel: level * XP_PER_LEVEL,
    progress: Math.max(0, Math.min(100, Math.round(((xp - levelStart) / XP_PER_LEVEL) * 100))),
  };
}

function leagueForPoints(points: number) {
  if (points >= 1000) return "Diamond";
  if (points >= 500) return "Platinum";
  if (points >= 200) return "Gold";
  if (points >= 75) return "Silver";
  return "Bronze";
}

async function notify(
  tx: any,
  profileId: string,
  kind: string,
  title: string,
  body: string,
  target?: { targetType: string; targetId: string },
) {
  await tx.insert(notificationsTable).values({
    id: `notification-${crypto.randomUUID()}`,
    profileId,
    kind,
    title,
    body,
    targetType: target?.targetType,
    targetId: target?.targetId,
  });
}

async function addReward(
  tx: any,
  profileId: string,
  battleId: string,
  kind: string,
  xp: number,
  rankingPoints: number,
) {
  const [profile] = await tx.select().from(profilesTable).where(eq(profilesTable.id, profileId));
  if (!profile) return false;
  const normalizedPlan = profile.plan === "PREMIUM_PRO"
    ? "PREMIUM_PRO"
    : profile.plan === "PREMIUM"
      ? "PREMIUM"
      : "FREE";
  const rewardedXp = Math.round(xp * planConfigFor(normalizedPlan).xpMultiplier);
  const [event] = await tx
    .insert(viralRewardEventsTable)
    .values({
      id: `reward-${crypto.randomUUID()}`,
      profileId,
      battleId,
      kind,
      xp: rewardedXp,
      rankingPoints,
    })
    .onConflictDoNothing()
    .returning();
  if (!event) return false;

  const nextXp = profile.xp + rewardedXp;
  const nextPoints = profile.rankingPoints + rankingPoints;
  const progress = xpProgress(nextXp);
  await tx
    .update(profilesTable)
    .set({
      xp: nextXp,
      level: progress.level,
      rankingPoints: nextPoints,
      league: leagueForPoints(nextPoints),
      updatedAt: new Date(),
    })
    .where(eq(profilesTable.id, profileId));
  if (progress.level > profile.level) {
    await notify(tx, profileId, "level", "New level unlocked", `You reached level ${progress.level}.`);
  }
  return true;
}

async function refreshRanksAndBadges(tx: any, profileIds: string[]) {
  const profiles = await tx
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.status, "ACTIVE"))
    .orderBy(desc(profilesTable.rankingPoints), desc(profilesTable.xp), asc(profilesTable.createdAt));

  for (const [index, profile] of profiles.entries()) {
    const nextRank = index + 1;
    if (profile.rank !== nextRank && profileIds.includes(profile.id)) {
      await tx.update(profilesTable).set({ rank: nextRank, updatedAt: new Date() }).where(eq(profilesTable.id, profile.id));
    }
  }

  for (const profileId of profileIds) {
    const [profile] = await tx.select().from(profilesTable).where(eq(profilesTable.id, profileId));
    if (!profile) continue;
    const earned = new Set(profile.badges);
    const totalBattles = profile.wins + profile.losses;
    const candidates = [
      totalBattles >= 1 && "First Battle",
      profile.wins >= 1 && "First Win",
      profile.wins >= 10 && "10 Wins",
      profile.wins >= 50 && "50 Wins",
      profile.wins >= 100 && "100 Wins",
      profile.xp >= 1000 && "Rising Star",
      profile.rank > 0 && profile.rank <= 100 && "Top 100",
      profile.rank > 0 && profile.rank <= 10 && "Top 10",
      profile.rank === 1 && "Champion",
      profile.streak >= 7 && "7 Day Streak",
      profile.streak >= 30 && "30 Day Streak",
    ].filter((badge): badge is string => Boolean(badge));
    const newlyEarned = candidates.filter((badge) => !earned.has(badge));
    if (newlyEarned.length === 0) continue;
    newlyEarned.forEach((badge) => earned.add(badge));
    await tx.update(profilesTable).set({ badges: [...earned], updatedAt: new Date() }).where(eq(profilesTable.id, profileId));
    for (const badge of newlyEarned) {
      await notify(tx, profileId, "badge", "Badge unlocked", `${badge} is now part of your ZYVIO profile.`);
    }
  }
}

export async function settleBattleInTransaction(
  tx: any,
  battleId: string,
  voterProfileId?: string | null,
) {
  const [existingResult] = await tx.select().from(battleResultsTable).where(eq(battleResultsTable.battleId, battleId));
  if (existingResult) return existingResult;

  const [battle] = await tx
    .select()
    .from(battlesTable)
    .where(eq(battlesTable.id, battleId));
  if (!battle || (battle.status !== "open" && battle.status !== "live")) return null;
  if (battle.endsAt.getTime() > Date.now()) return null;

  const entries = await tx
    .select()
    .from(battleParticipantsTable)
    .where(eq(battleParticipantsTable.battleId, battleId))
    .orderBy(desc(battleParticipantsTable.score), desc(battleParticipantsTable.votes), asc(battleParticipantsTable.joinedAt));
  if (entries.length === 0 || entries.length > 2) return null;

  const winner = entries[0];
  const loser = entries[1];
  if (!winner) return null;
  // A Battle that never received a challenger is a no-contest. Complete it
  // without manufacturing a loser or awarding the host a win.
  if (!loser) {
    const [result] = await tx.insert(battleResultsTable).values({
      id: `result-${crypto.randomUUID()}`,
      battleId,
      winnerParticipantId: null,
      loserParticipantId: null,
    }).onConflictDoNothing().returning();
    if (!result) return null;
    await tx.update(battlesTable).set({ status: "completed", updatedAt: new Date() }).where(eq(battlesTable.id, battleId));
    await notify(tx, winner.profileId, "battle", "Battle ended without a contest", "No challenger joined this Battle.", {
      targetType: "BATTLE",
      targetId: battleId,
    });
    return result;
  }

  if (voterProfileId) {
    const [voterEntry] = await tx
      .select({ id: battleParticipantsTable.id })
      .from(battleParticipantsTable)
      .where(and(
        eq(battleParticipantsTable.battleId, battleId),
        eq(battleParticipantsTable.profileId, voterProfileId),
      ));
    if (voterEntry) return null;

    const [vote] = await tx
      .select({ id: votesTable.id })
      .from(votesTable)
      .where(and(
        eq(votesTable.battleId, battleId),
        eq(votesTable.voterProfileId, voterProfileId),
      ));
    if (!vote) return null;
  }

  const isDraw = entries.every((entry: { score: number }) => entry.score === winner.score)
    || entries.every((entry: { votes: number }) => entry.votes === 0);
  const [result] = await tx
    .insert(battleResultsTable)
    .values({
      id: `result-${crypto.randomUUID()}`,
      battleId,
      winnerParticipantId: isDraw ? null : winner.id,
      loserParticipantId: isDraw ? null : loser.id,
    })
    .onConflictDoNothing()
    .returning();
  if (!result) return null;

  await tx.update(battlesTable).set({ status: "completed", updatedAt: new Date() }).where(eq(battlesTable.id, battleId));
  if (!isDraw) {
    await tx.update(profilesTable).set({
      wins: sql`${profilesTable.wins} + 1`,
      updatedAt: new Date(),
    }).where(eq(profilesTable.id, winner.profileId));
    await tx.update(profilesTable).set({
      losses: sql`${profilesTable.losses} + 1`,
      updatedAt: new Date(),
    }).where(eq(profilesTable.id, loser.profileId));

    await addReward(tx, winner.profileId, battleId, "battle-win", 250, 25);
    await addReward(tx, loser.profileId, battleId, "battle-loss", 50, 5);
  }
  if (voterProfileId && voterProfileId !== winner.profileId && voterProfileId !== loser.profileId) {
    await addReward(tx, voterProfileId, battleId, "battle-vote", 10, 1);
  }
  if (isDraw) {
    await notify(tx, winner.profileId, "battle", "Battle draw", "This Battle ended without a winner.", { targetType: "BATTLE", targetId: battleId });
    await notify(tx, loser.profileId, "battle", "Battle draw", "This Battle ended without a winner.", { targetType: "BATTLE", targetId: battleId });
  } else {
    await notify(tx, winner.profileId, "battle", "You won a Battle", "Your result is now part of your ZYVIO record.", { targetType: "BATTLE", targetId: battleId });
    await notify(tx, loser.profileId, "battle", "Battle completed", "Keep going — your next Battle can move your ranking.", { targetType: "BATTLE", targetId: battleId });
  }
  await refreshRanksAndBadges(
    tx,
    [winner.profileId, loser.profileId, voterProfileId].filter(
      (profileId): profileId is string => Boolean(profileId),
    ),
  );
  return result;
}

/** Best-effort idempotent expiry pass for Battles no longer being viewed. */
export async function settleExpiredBattles() {
  const expired = await db
    .select({ id: battlesTable.id })
    .from(battlesTable)
    .where(and(
      eq(battlesTable.contentStatus, "ACTIVE"),
      inArray(battlesTable.status, ["open", "live"]),
      lte(battlesTable.endsAt, new Date()),
    ))
    .limit(50);
  for (const battle of expired) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from ${battlesTable} where ${battlesTable.id} = ${battle.id} for update`);
      await settleBattleInTransaction(tx, battle.id);
    });
  }
}
