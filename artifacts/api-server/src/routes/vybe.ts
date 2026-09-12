import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activitiesTable,
  battleParticipantsTable,
  battleResultsTable,
  battlesTable,
  notificationsTable,
  moderationReportsTable,
  appSettingsTable,
  profilesTable,
  votesTable,
  userActivityEventsTable,
  viralRewardEventsTable,
  type Activity,
  type Battle,
  type Profile,
} from "@workspace/db";
import {
  CreateBattleBody,
  CreateBattleResponse,
  GenerateIdeasBody,
  GenerateIdeasResponse,
  GetBattleParams,
  GetBattleResponse,
  GetDashboardResponse,
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
  GetProfileResponse,
  JoinBattleParams,
  JoinBattleResponse,
  ListBattlesQueryParams,
  ListBattlesResponse,
  ListNotificationsResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  VoteBattleBody,
  VoteBattleParams,
  CreateReportBody,
  CreateReportResponse,
} from "@workspace/api-zod";
import {
  currentUserFrom,
  requireAuthenticatedUser,
} from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { settleBattleInTransaction, xpProgress } from "../viralCore";
import { getUserPlan } from "../lib/premium";
import {
  AiUsageLimitError,
  completeAiUsage,
  reserveAiUsage,
} from "../lib/aiUsage";

const router: IRouter = Router();

router.use(requireAuthenticatedUser);

const reportRateLimit = rateLimit({ name: "reports", windowMs: 10 * 60_000, max: 5 });
const battleCreateRateLimit = rateLimit({ name: "battle-create", windowMs: 10 * 60_000, max: 5 });
const battleJoinRateLimit = rateLimit({ name: "battle-join", windowMs: 5 * 60_000, max: 10 });
const battleVoteRateLimit = rateLimit({ name: "battle-vote", windowMs: 60_000, max: 10 });
const aiRateLimit = rateLimit({ name: "ai-ideas", windowMs: 10 * 60_000, max: 5 });

router.post("/reports", reportRateLimit, async (req, res, next) => {
  try {
    const parsed = CreateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global"));
    const [admin] = settings?.moderationAutoAssign
      ? await db.select({ id: profilesTable.id }).from(profilesTable).where(and(eq(profilesTable.role, "ADMIN"), eq(profilesTable.status, "ACTIVE"))).limit(1)
      : [undefined];
    const [report] = await db.insert(moderationReportsTable).values({
      id: `report-${crypto.randomUUID()}`,
      reporterProfileId: profile.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      description: parsed.data.description ?? "",
      assignedAdminId: admin?.id,
    }).returning();
    if (!report) {
      res.status(500).json({ error: "Report creation failed" });
      return;
    }
    res.status(201).json(CreateReportResponse.parse(report));
  } catch (error) {
    next(error);
  }
});

function summary(profile: Profile) {
  const totalMatches = profile.wins + profile.losses;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    country: profile.country,
    avatarUrl: profile.avatarUrl,
    level: profile.level,
    wins: profile.wins,
    losses: profile.losses,
    winRate: totalMatches ? Math.round((profile.wins / totalMatches) * 100) : 0,
    rankingPoints: profile.rankingPoints,
  };
}

function profileView(profile: Profile) {
  const totalMatches = profile.wins + profile.losses;
  return {
    ...profile,
    winRate: totalMatches ? Math.round((profile.wins / totalMatches) * 100) : 0,
    ...xpProgress(profile.xp),
  };
}

async function serializeBattle(battle: Battle, currentUserId: string) {
  const entries = await db
    .select()
    .from(battleParticipantsTable)
    .where(eq(battleParticipantsTable.battleId, battle.id))
    .orderBy(desc(battleParticipantsTable.score));
  const profiles =
    entries.length > 0
      ? await db
          .select()
          .from(profilesTable)
          .where(and(inArray(profilesTable.id, entries.map((entry) => entry.profileId)), eq(profilesTable.status, "ACTIVE")))
      : [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const [result] = await db.select().from(battleResultsTable).where(eq(battleResultsTable.battleId, battle.id));
  const participants = entries.flatMap((entry) => {
    const profile = profileMap.get(entry.profileId);
    if (!profile) return [];
    return [{
      id: entry.id,
      user: summary(profile),
      submissionLabel: entry.submissionLabel,
      score: entry.score,
      votes: entry.votes,
    }];
  });

  return {
    id: battle.id,
    title: battle.title,
    category: battle.category,
    status: battle.status as "open" | "live" | "completed",
    prompt: battle.prompt,
    createdAt: battle.createdAt,
    endsAt: battle.endsAt,
    participantCount: participants.length,
    maxParticipants: battle.maxParticipants,
    rewardXp: battle.rewardXp,
    coverTone: battle.coverTone,
    isJoined: entries.some((entry) => entry.profileId === currentUserId),
    winnerParticipantId: result?.winnerParticipantId ?? null,
    loserParticipantId: result?.loserParticipantId ?? null,
    participants,
  };
}

async function listSerializedBattles(
  currentUserId: string,
  category?: string,
  status?: "open" | "live" | "completed",
) {
  const filters = [];
  if (category) filters.push(eq(battlesTable.category, category));
  if (status) filters.push(eq(battlesTable.status, status));
  filters.push(eq(battlesTable.contentStatus, "ACTIVE"));
  const battles = await db
    .select()
    .from(battlesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(battlesTable.createdAt));
  return Promise.all(
    battles.map((battle) => serializeBattle(battle, currentUserId)),
  );
}

async function buildLeaderboard(
  profile: Profile,
  scope: "global" | "country",
  period: string,
) {
  const rows = await db
    .select()
    .from(profilesTable)
    .where(scope === "country"
      ? and(eq(profilesTable.country, profile.country), eq(profilesTable.status, "ACTIVE"))
      : eq(profilesTable.status, "ACTIVE"))
    .orderBy(desc(profilesTable.rankingPoints), desc(profilesTable.xp))
    .limit(100);
  const since = period === "weekly"
    ? new Date(Date.now() - 7 * 86_400_000)
    : period === "monthly"
      ? new Date(Date.now() - 30 * 86_400_000)
      : null;
  const rewards = since
    ? await db.select().from(viralRewardEventsTable).where(gte(viralRewardEventsTable.createdAt, since))
    : [];
  const periodStats = new Map<string, { xp: number; rankingPoints: number; wins: number; losses: number }>();
  for (const reward of rewards) {
    const current = periodStats.get(reward.profileId) ?? { xp: 0, rankingPoints: 0, wins: 0, losses: 0 };
    current.xp += reward.xp;
    current.rankingPoints += reward.rankingPoints;
    if (reward.kind === "battle-win") current.wins += 1;
    if (reward.kind === "battle-loss") current.losses += 1;
    periodStats.set(reward.profileId, current);
  }
  const rankedRows = [...rows].sort((a, b) => {
    const aStats = periodStats.get(a.id);
    const bStats = periodStats.get(b.id);
    return (bStats?.rankingPoints ?? b.rankingPoints) - (aStats?.rankingPoints ?? a.rankingPoints)
      || (bStats?.xp ?? b.xp) - (aStats?.xp ?? a.xp);
  });
  const entries = rankedRows.map((row, index) => {
    const stats = periodStats.get(row.id);
    const xp = stats?.xp ?? row.xp;
    const wins = stats?.wins ?? row.wins;
    const losses = stats?.losses ?? row.losses;
    return {
    position: index + 1,
    user: summary(row),
    xp,
    wins,
    losses,
    winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0,
    rankingPoints: stats?.rankingPoints ?? row.rankingPoints,
    streak: row.streak,
    league: row.league,
    };
  });
  const currentUser = entries.find((entry) => entry.user.id === profile.id) ?? {
    position: profile.rank || entries.length + 1,
    user: summary(profile),
    xp: periodStats.get(profile.id)?.xp ?? profile.xp,
    wins: periodStats.get(profile.id)?.wins ?? profile.wins,
    losses: periodStats.get(profile.id)?.losses ?? profile.losses,
    winRate: profile.wins + profile.losses ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) : 0,
    rankingPoints: periodStats.get(profile.id)?.rankingPoints ?? profile.rankingPoints,
    streak: profile.streak,
    league: profile.league,
  };
  return { scope, period, entries, currentUser };
}

router.get("/dashboard", async (_req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const battles = await listSerializedBattles(profile.id);
    const ranking = await buildLeaderboard(profile, "global", "weekly");
    const activityRows = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.profileId, profile.id))
      .orderBy(desc(activitiesTable.createdAt))
      .limit(6);
    const activeBattles = battles.filter(
      (battle) => battle.status === "open" || battle.status === "live",
    ).length;
    const totalMatches = profile.wins + profile.losses;

    res.json(
      GetDashboardResponse.parse({
        profile: profileView(profile),
        featuredBattles: battles.slice(0, 3),
        trendingBattles: battles.slice(1),
        leaderboardPreview: ranking.entries.slice(0, 5),
        activity: activityRows.map((activity: Activity) => ({
          id: activity.id,
          text: activity.text,
          time: activity.time,
          kind: activity.kind,
        })),
        stats: {
          activeBattles,
          weeklyXp: profile.xp,
          winRate: totalMatches
            ? Math.round((profile.wins / totalMatches) * 100)
            : 0,
          globalRank: profile.rank,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/battles", async (req, res, next) => {
  try {
    const parsed = ListBattlesQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    res.json(
      ListBattlesResponse.parse(
        await listSerializedBattles(
          profile.id,
          parsed.data.category,
          parsed.data.status,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/battles", battleCreateRateLimit, async (req, res, next) => {
  try {
    const parsed = CreateBattleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    const endsAt = new Date(parsed.data.endsAt);
    if (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
      res.status(400).json({ error: "Battle end time must be in the future" });
      return;
    }
    if (parsed.data.maxParticipants !== 2) {
      res.status(400).json({ error: "ZYVIO Battles are limited to 2 participants" });
      return;
    }
    const battleId = `battle-${crypto.randomUUID()}`;
    const battle = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(battlesTable)
        .values({
          id: battleId,
          title: parsed.data.title,
          category: parsed.data.category,
          prompt: parsed.data.prompt,
           endsAt,
           maxParticipants: parsed.data.maxParticipants,
          creatorProfileId: profile.id,
        })
        .returning();
      if (!created) return undefined;
      await tx.insert(battleParticipantsTable).values({
        id: `entry-${crypto.randomUUID()}`,
        battleId,
        profileId: profile.id,
        submissionLabel: "Host entry",
      });
      return created;
    });
    if (!battle) throw new Error("Battle creation failed");
    res.status(201).json(
      CreateBattleResponse.parse(await serializeBattle(battle, profile.id)),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/battles/:battleId", async (req, res, next) => {
  try {
    const parsed = GetBattleParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [battle] = await db
      .select()
      .from(battlesTable)
      .where(and(eq(battlesTable.id, parsed.data.battleId), eq(battlesTable.contentStatus, "ACTIVE")));
    if (!battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    const profile = currentUserFrom(res);
    const currentBattle = battle.endsAt.getTime() <= Date.now() && (battle.status === "open" || battle.status === "live")
      ? await db.transaction(async (tx) => {
          const result = await settleBattleInTransaction(tx, battle.id);
          const [updated] = await tx.select().from(battlesTable).where(eq(battlesTable.id, battle.id));
          return result ? updated : battle;
        })
      : battle;
    res.json(
      GetBattleResponse.parse(await serializeBattle(currentBattle, profile.id)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/battles/:battleId", battleJoinRateLimit, async (req, res, next) => {
  try {
    const parsed = JoinBattleParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    const battle = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from ${battlesTable} where ${battlesTable.id} = ${parsed.data.battleId} for update`);
      const [lockedBattle] = await tx.select().from(battlesTable).where(and(eq(battlesTable.id, parsed.data.battleId), eq(battlesTable.contentStatus, "ACTIVE")));
      if (!lockedBattle) return { error: "Battle not found", status: 404 as const };
      if (lockedBattle.status !== "open" && lockedBattle.status !== "live") return { error: "Battle is closed", status: 409 as const };
      if (lockedBattle.endsAt.getTime() <= Date.now()) return { error: "Battle has ended", status: 409 as const };
      const currentEntries = await tx.select().from(battleParticipantsTable).where(eq(battleParticipantsTable.battleId, lockedBattle.id));
      if (currentEntries.some((entry) => entry.profileId === profile.id)) return { battle: lockedBattle };
      if (currentEntries.length >= lockedBattle.maxParticipants) return { error: "This 1v1 Battle already has two players", status: 409 as const };
      await tx.insert(battleParticipantsTable).values({
        id: `entry-${crypto.randomUUID()}`,
        battleId: lockedBattle.id,
        profileId: profile.id,
        submissionLabel: "Challenger entry",
      });
      const [updated] = await tx.update(battlesTable).set({ status: "live", updatedAt: new Date() }).where(eq(battlesTable.id, lockedBattle.id)).returning();
      return { battle: updated ?? lockedBattle };
    });
    if ("error" in battle) {
      res.status(battle.status ?? 409).json({ error: battle.error });
      return;
    }
    if (!battle.battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    res.json(
      JoinBattleResponse.parse(await serializeBattle(battle.battle, profile.id)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/battles/:battleId/vote", battleVoteRateLimit, async (req, res, next) => {
  try {
    const params = VoteBattleParams.safeParse(req.params);
    const body = VoteBattleBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select id from ${battlesTable} where ${battlesTable.id} = ${params.data.battleId} for update`);
        const [activeBattle] = await tx.select().from(battlesTable).where(and(eq(battlesTable.id, params.data.battleId), eq(battlesTable.contentStatus, "ACTIVE")));
        if (!activeBattle) return { error: "Battle not found", status: 404 as const };
        if (activeBattle.status !== "open" && activeBattle.status !== "live") {
          return { error: "Battle is closed", status: 409 as const };
        }
        if (activeBattle.endsAt.getTime() <= Date.now()) {
          return { error: "Battle has ended", status: 409 as const };
        }
        const [participant] = await tx
          .select()
          .from(battleParticipantsTable)
          .where(and(eq(battleParticipantsTable.id, body.data.participantId), eq(battleParticipantsTable.battleId, params.data.battleId)));
        if (!participant) return { error: "Participant not found", status: 404 as const };
        if (participant.profileId === profile.id) return { error: "You cannot vote for your own entry", status: 400 as const };
        await tx.insert(votesTable).values({
          id: `vote-${crypto.randomUUID()}`,
          battleId: params.data.battleId,
          participantId: participant.id,
          voterProfileId: profile.id,
        });
        await tx.update(battleParticipantsTable).set({
          votes: sql`${battleParticipantsTable.votes} + 1`,
          score: sql`${battleParticipantsTable.score} + 3`,
        }).where(eq(battleParticipantsTable.id, participant.id));
        await settleBattleInTransaction(tx, activeBattle.id, profile.id);
        return { battle: activeBattle };
      });
      if ("error" in result && result.error) {
        res.status(result.status ?? 400).json({ error: result.error });
        return;
      }
      if (!("battle" in result) || !result.battle) {
        res.status(409).json({ error: "Vote could not be completed" });
        return;
      }
      res.json(await serializeBattle(result.battle, profile.id));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        res.status(409).json({ error: "You already voted in this battle" });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.get("/profile", (_req, res) => {
  res.json(GetProfileResponse.parse(profileView(currentUserFrom(res))));
});

router.patch("/profile", async (req, res, next) => {
  try {
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    const [updated] = await db
      .update(profilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(profilesTable.id, profile.id))
      .returning();
    res.json(UpdateProfileResponse.parse(updated));
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard", async (req, res, next) => {
  try {
    const parsed = GetLeaderboardQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    res.json(
      GetLeaderboardResponse.parse(
        await buildLeaderboard(
          currentUserFrom(res),
          parsed.data.scope,
          parsed.data.period,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (_req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.profileId, profile.id))
      .orderBy(desc(notificationsTable.createdAt));
    res.json(ListNotificationsResponse.parse(notifications));
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:notificationId/read", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const [notification] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, req.params.notificationId), eq(notificationsTable.profileId, profile.id)))
      .returning();
    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.post("/notifications/read-all", async (_req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.profileId, profile.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/ai/ideas", aiRateLimit, async (req, res, next) => {
  let usageId: string | undefined;
  try {
    const parsed = GenerateIdeasBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI is not configured" });
      return;
    }
    const profile = currentUserFrom(res);
    const plan = await getUserPlan(profile.id);
    const prompt = `Generate 5 concise, original ZYVIO Battle concepts as a JSON array of strings. Topic: ${parsed.data.topic}. Category: ${parsed.data.category ?? "any"}. Do not include markdown or numbering.`;
    try {
      const reservation = await reserveAiUsage({
        profileId: profile.id,
        plan,
        feature: "battle-ideas",
        promptCharacters: prompt.length,
      });
      usageId = reservation?.id;
    } catch (error) {
      if (error instanceof AiUsageLimitError) {
        res.status(429).json({
          error: "Daily AI usage limit reached",
          code: "AI_USAGE_LIMIT",
          plan: error.plan,
          used: error.used,
          limit: error.limit,
        });
        return;
      }
      throw error;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      let upstream: Response;
      try {
        upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "gpt-5-mini",
            max_completion_tokens: 700,
            messages: [
              {
                role: "system",
                content: "You are ZYVIO AI, a creative competition producer.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });
      } catch (error) {
        if (usageId) await completeAiUsage(usageId, "provider_error").catch(() => undefined);
        if (error instanceof Error && error.name === "AbortError") {
          res.status(504).json({ error: "AI provider timed out" });
          return;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (!upstream.ok) {
        await upstream.body?.cancel().catch(() => undefined);
        if (usageId) await completeAiUsage(usageId, "provider_error").catch(() => undefined);
        req.log.error({ status: upstream.status }, "OpenAI request failed");
        if (upstream.status === 429) {
          res.status(503).json({ error: "AI provider has no remaining credits" });
          return;
        }
        res.status(502).json({ error: "AI provider request failed" });
        return;
      }
      const payload = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
      let ideas: string[];
      try {
        const parsedIdeas: unknown = JSON.parse(content);
        ideas = Array.isArray(parsedIdeas)
          ? parsedIdeas.filter((idea): idea is string => typeof idea === "string").slice(0, 5)
          : [];
      } catch {
        ideas = content
          .split("\n")
          .map((idea) => idea.replace(/^[-*\d.)\s]+/, "").trim())
          .filter(Boolean)
          .slice(0, 5);
      }
      if (usageId) await completeAiUsage(usageId, "success");
      res.json(GenerateIdeasResponse.parse({ ideas }));
    } catch (error) {
      if (usageId) await completeAiUsage(usageId, "provider_error").catch(() => undefined);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;