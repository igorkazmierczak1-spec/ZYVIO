import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activitiesTable,
  battleParticipantsTable,
  battlesTable,
  notificationsTable,
  profilesTable,
  votesTable,
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
} from "@workspace/api-zod";
import {
  currentUserFrom,
  requireAuthenticatedUser,
} from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuthenticatedUser);

function summary(profile: Profile) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    country: profile.country,
    avatarUrl: profile.avatarUrl,
    level: profile.level,
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
          .where(inArray(profilesTable.id, entries.map((entry) => entry.profileId)))
      : [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
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
    .where(scope === "country" ? eq(profilesTable.country, profile.country) : undefined)
    .orderBy(desc(profilesTable.xp))
    .limit(100);
  const entries = rows.map((row, index) => ({
    position: index + 1,
    user: summary(row),
    xp: row.xp,
    wins: row.wins,
    streak: row.streak,
    league: row.league,
  }));
  const currentUser = entries.find((entry) => entry.user.id === profile.id) ?? {
    position: profile.rank,
    user: summary(profile),
    xp: profile.xp,
    wins: profile.wins,
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
        profile,
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

router.post("/battles", async (req, res, next) => {
  try {
    const parsed = CreateBattleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    const [battle] = await db
      .insert(battlesTable)
      .values({
        id: `battle-${crypto.randomUUID()}`,
        title: parsed.data.title,
        category: parsed.data.category,
        prompt: parsed.data.prompt,
        endsAt: new Date(parsed.data.endsAt),
        maxParticipants: parsed.data.maxParticipants ?? 8,
      })
      .returning();
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
      .where(eq(battlesTable.id, parsed.data.battleId));
    if (!battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    const profile = currentUserFrom(res);
    res.json(
      GetBattleResponse.parse(await serializeBattle(battle, profile.id)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/battles/:battleId", async (req, res, next) => {
  try {
    const parsed = JoinBattleParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = currentUserFrom(res);
    const [battle] = await db
      .select()
      .from(battlesTable)
      .where(eq(battlesTable.id, parsed.data.battleId));
    if (!battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    if (battle.status !== "open" && battle.status !== "live") {
      res.status(409).json({ error: "Battle is closed" });
      return;
    }
    await db
      .insert(battleParticipantsTable)
      .values({
        id: `entry-${crypto.randomUUID()}`,
        battleId: battle.id,
        profileId: profile.id,
        submissionLabel: "New entry",
      })
      .onConflictDoNothing();
    res.json(
      JoinBattleResponse.parse(await serializeBattle(battle, profile.id)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/battles/:battleId/vote", async (req, res, next) => {
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
    const [participant] = await db
      .select()
      .from(battleParticipantsTable)
      .where(
        and(
          eq(battleParticipantsTable.id, body.data.participantId),
          eq(battleParticipantsTable.battleId, params.data.battleId),
        ),
      );
    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }
    if (participant.profileId === profile.id) {
      res.status(400).json({ error: "You cannot vote for your own entry" });
      return;
    }
    const alreadyVoted = await db
      .select({ id: votesTable.id })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.battleId, params.data.battleId),
          eq(votesTable.voterProfileId, profile.id),
        ),
      );
    if (alreadyVoted.length) {
      res.status(409).json({ error: "You already voted in this battle" });
      return;
    }
    await db.insert(votesTable).values({
      id: `vote-${crypto.randomUUID()}`,
      battleId: params.data.battleId,
      participantId: participant.id,
      voterProfileId: profile.id,
    });
    await db
      .update(battleParticipantsTable)
      .set({
        votes: sql`${battleParticipantsTable.votes} + 1`,
        score: sql`${battleParticipantsTable.score} + 3`,
      })
      .where(eq(battleParticipantsTable.id, participant.id));
    const [battle] = await db
      .select()
      .from(battlesTable)
      .where(eq(battlesTable.id, params.data.battleId));
    if (!battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    res.json(await serializeBattle(battle, profile.id));
  } catch (error) {
    next(error);
  }
});

router.get("/profile", (_req, res) => {
  res.json(GetProfileResponse.parse(currentUserFrom(res)));
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

router.post("/ai/ideas", async (req, res, next) => {
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
    const prompt = `Generate 5 concise, original VYBE Battle concepts as a JSON array of strings. Topic: ${parsed.data.topic}. Category: ${parsed.data.category ?? "any"}. Do not include markdown or numbering.`;
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        max_completion_tokens: 700,
        messages: [
          {
            role: "system",
            content: "You are VYBE AI, a creative competition producer.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!upstream.ok) {
      const errorText = await upstream.text();
      req.log.error({ status: upstream.status, errorText }, "OpenAI request failed");
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
    res.json(GenerateIdeasResponse.parse({ ideas }));
  } catch (error) {
    next(error);
  }
});

export default router;