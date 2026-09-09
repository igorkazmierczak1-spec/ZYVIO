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

const router: IRouter = Router();
const CURRENT_USER_ID = "user-igor";

const seedBattles = [
  {
    id: "battle-neon-portraits",
    title: "Neon after dark",
    category: "Photo",
    status: "live",
    prompt: "Show us the most cinematic color you can find after sunset.",
    maxParticipants: 8,
    rewardXp: 350,
    coverTone: "violet",
    offsetHours: 18,
  },
  {
    id: "battle-odd-one-out",
    title: "Make it unexpected",
    category: "Creativity",
    status: "open",
    prompt: "Turn an ordinary object into an unforgettable idea.",
    maxParticipants: 12,
    rewardXp: 280,
    coverTone: "coral",
    offsetHours: 42,
  },
  {
    id: "battle-quiet-flex",
    title: "Quiet flex",
    category: "Text",
    status: "open",
    prompt: "One sentence. No context. Maximum impact.",
    maxParticipants: 16,
    rewardXp: 220,
    coverTone: "cyan",
    offsetHours: 30,
  },
  {
    id: "battle-ai-remix",
    title: "AI remix lab",
    category: "AI",
    status: "open",
    prompt: "Give a machine a strange brief and make the result feel human.",
    maxParticipants: 10,
    rewardXp: 420,
    coverTone: "lime",
    offsetHours: 54,
  },
];

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

async function ensureSeeded(): Promise<void> {
  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, CURRENT_USER_ID));
  if (existing) return;

  await db.insert(profilesTable).values([
    {
      id: CURRENT_USER_ID,
      username: "igor",
      displayName: "Igor Paradowski",
      country: "PL",
      language: "en",
      avatarUrl: "",
      bio: "Building ideas that deserve a spotlight.",
      level: 12,
      xp: 2840,
      wins: 24,
      losses: 9,
      rank: 128,
      league: "Gold",
      streak: 7,
      badges: ["First Battle", "10 Wins", "7 Day Streak"],
    },
    {
      id: "user-maya",
      username: "maya",
      displayName: "Maya Chen",
      country: "US",
      language: "en",
      avatarUrl: "",
      bio: "Visual thinker.",
      level: 18,
      xp: 5210,
      wins: 48,
      losses: 12,
      rank: 7,
      league: "Diamond",
      streak: 14,
      badges: ["Battle Master", "Top 10"],
    },
    {
      id: "user-ali",
      username: "ali.codes",
      displayName: "Ali Rahman",
      country: "GB",
      language: "en",
      avatarUrl: "",
      bio: "Code, culture, curiosity.",
      level: 16,
      xp: 4460,
      wins: 39,
      losses: 18,
      rank: 15,
      league: "Platinum",
      streak: 11,
      badges: ["First Battle", "10 Wins"],
    },
    {
      id: "user-sofia",
      username: "sofia.jpg",
      displayName: "Sofia Weber",
      country: "DE",
      language: "de",
      avatarUrl: "",
      bio: "Finding the frame.",
      level: 14,
      xp: 3910,
      wins: 34,
      losses: 20,
      rank: 28,
      league: "Platinum",
      streak: 5,
      badges: ["First Battle", "7 Day Streak"],
    },
  ]);

  const now = new Date();
  await db.insert(battlesTable).values(
    seedBattles.map((battle) => ({
      id: battle.id,
      title: battle.title,
      category: battle.category,
      status: battle.status,
      prompt: battle.prompt,
      createdAt: new Date(now.getTime() - battle.offsetHours * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + (battle.offsetHours + 18) * 60 * 60 * 1000),
      maxParticipants: battle.maxParticipants,
      rewardXp: battle.rewardXp,
      coverTone: battle.coverTone,
    })),
  );

  await db.insert(battleParticipantsTable).values([
    {
      id: "entry-neon-maya",
      battleId: "battle-neon-portraits",
      profileId: "user-maya",
      submissionLabel: "Chromatic silence",
      score: 92,
      votes: 38,
    },
    {
      id: "entry-neon-igor",
      battleId: "battle-neon-portraits",
      profileId: CURRENT_USER_ID,
      submissionLabel: "Last train home",
      score: 88,
      votes: 31,
    },
    {
      id: "entry-odd-ali",
      battleId: "battle-odd-one-out",
      profileId: "user-ali",
      submissionLabel: "The useful mistake",
      score: 81,
      votes: 22,
    },
    {
      id: "entry-quiet-sofia",
      battleId: "battle-quiet-flex",
      profileId: "user-sofia",
      submissionLabel: "I left the light on.",
      score: 74,
      votes: 18,
    },
    {
      id: "entry-ai-igor",
      battleId: "battle-ai-remix",
      profileId: CURRENT_USER_ID,
      submissionLabel: "A brief for the brave",
      score: 65,
      votes: 9,
    },
  ]);

  await db.insert(notificationsTable).values([
    {
      id: "notification-welcome",
      profileId: CURRENT_USER_ID,
      kind: "level",
      title: "You are on a 7 day streak",
      body: "Keep showing up to unlock the next badge.",
      read: false,
    },
    {
      id: "notification-battle",
      profileId: CURRENT_USER_ID,
      kind: "battle",
      title: "Your battle is heating up",
      body: "Neon after dark has 69 votes so far.",
      read: false,
    },
    {
      id: "notification-rank",
      profileId: CURRENT_USER_ID,
      kind: "rank",
      title: "You moved up 12 places",
      body: "You are now #128 globally.",
      read: true,
    },
  ]);

  await db.insert(activitiesTable).values([
    {
      id: "activity-1",
      profileId: CURRENT_USER_ID,
      kind: "vote",
      text: "You voted in Neon after dark",
      time: "18 min ago",
    },
    {
      id: "activity-2",
      profileId: CURRENT_USER_ID,
      kind: "level",
      text: "You reached level 12",
      time: "Yesterday",
    },
    {
      id: "activity-3",
      profileId: CURRENT_USER_ID,
      kind: "battle",
      text: "You joined AI remix lab",
      time: "2 days ago",
    },
  ]);
}

async function currentProfile(): Promise<Profile> {
  await ensureSeeded();
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, CURRENT_USER_ID));
  if (!profile) throw new Error("Current profile is missing");
  return profile;
}

async function serializeBattle(battle: Battle) {
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
  return {
    id: battle.id,
    title: battle.title,
    category: battle.category,
    status: battle.status as "open" | "live" | "completed",
    prompt: battle.prompt,
    createdAt: battle.createdAt,
    endsAt: battle.endsAt,
    participantCount: entries.length,
    maxParticipants: battle.maxParticipants,
    rewardXp: battle.rewardXp,
    coverTone: battle.coverTone,
    isJoined: entries.some((entry) => entry.profileId === CURRENT_USER_ID),
    participants: entries.map((entry) => ({
      id: entry.id,
      user: summary(profileMap.get(entry.profileId) ?? ({} as Profile)),
      submissionLabel: entry.submissionLabel,
      score: entry.score,
      votes: entry.votes,
    })),
  };
}

async function listSerializedBattles(
  category?: string,
  status?: "open" | "live" | "completed",
) {
  await ensureSeeded();
  const filters = [];
  if (category) filters.push(eq(battlesTable.category, category));
  if (status) filters.push(eq(battlesTable.status, status));
  const battles = await db
    .select()
    .from(battlesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(battlesTable.createdAt));
  return Promise.all(battles.map(serializeBattle));
}

async function leaderboard(scope: "global" | "country", period: string) {
  const profile = await currentProfile();
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
  const currentUser = entries.find((entry) => entry.user.id === CURRENT_USER_ID) ?? {
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
    const profile = await currentProfile();
    const battles = await listSerializedBattles();
    const ranking = await leaderboard("global", "weekly");
    const activityRows = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.profileId, CURRENT_USER_ID))
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
          winRate: totalMatches ? Math.round((profile.wins / totalMatches) * 100) : 0,
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
    const battles = await listSerializedBattles(parsed.data.category, parsed.data.status);
    res.json(ListBattlesResponse.parse(battles));
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
    await currentProfile();
    const id = `battle-${crypto.randomUUID()}`;
    const coverTones = ["violet", "coral", "cyan", "lime"];
    const battle: Battle = {
      id,
      title: parsed.data.title,
      category: parsed.data.category,
      status: "open",
      prompt: parsed.data.prompt,
      createdAt: new Date(),
      endsAt: parsed.data.endsAt,
      maxParticipants: parsed.data.maxParticipants,
      rewardXp: 250,
      coverTone: coverTones[Math.floor(Math.random() * coverTones.length)] ?? "violet",
    };
    await db.insert(battlesTable).values(battle);
    await db.insert(battleParticipantsTable).values({
      id: `entry-${crypto.randomUUID()}`,
      battleId: id,
      profileId: CURRENT_USER_ID,
      submissionLabel: "Creator's first move",
      score: 0,
      votes: 0,
    });
    const response = await serializeBattle(battle);
    res.status(201).json(CreateBattleResponse.parse(response));
  } catch (error) {
    next(error);
  }
});

router.get("/battles/:battleId", async (req, res, next) => {
  try {
    const params = GetBattleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await currentProfile();
    const [battle] = await db
      .select()
      .from(battlesTable)
      .where(eq(battlesTable.id, params.data.battleId));
    if (!battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    res.json(GetBattleResponse.parse(await serializeBattle(battle)));
  } catch (error) {
    next(error);
  }
});

router.post("/battles/:battleId", async (req, res, next) => {
  try {
    const params = JoinBattleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await currentProfile();
    const [battle] = await db
      .select()
      .from(battlesTable)
      .where(eq(battlesTable.id, params.data.battleId));
    if (!battle) {
      res.status(404).json({ error: "Battle not found" });
      return;
    }
    if (battle.status === "completed") {
      res.status(400).json({ error: "This battle is already completed" });
      return;
    }
    const existing = await db
      .select()
      .from(battleParticipantsTable)
      .where(
        and(
          eq(battleParticipantsTable.battleId, battle.id),
          eq(battleParticipantsTable.profileId, CURRENT_USER_ID),
        ),
      );
    if (!existing.length) {
      const entries = await db
        .select({ id: battleParticipantsTable.id })
        .from(battleParticipantsTable)
        .where(eq(battleParticipantsTable.battleId, battle.id));
      if (entries.length >= battle.maxParticipants) {
        res.status(400).json({ error: "This battle is full" });
        return;
      }
      await db.insert(battleParticipantsTable).values({
        id: `entry-${crypto.randomUUID()}`,
        battleId: battle.id,
        profileId: CURRENT_USER_ID,
        submissionLabel: "New challenger",
        score: 0,
        votes: 0,
      });
    }
    res.json(JoinBattleResponse.parse(await serializeBattle(battle)));
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
    await currentProfile();
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
    if (participant.profileId === CURRENT_USER_ID) {
      res.status(400).json({ error: "You cannot vote for your own entry" });
      return;
    }
    const alreadyVoted = await db
      .select({ id: votesTable.id })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.battleId, params.data.battleId),
          eq(votesTable.voterProfileId, CURRENT_USER_ID),
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
      voterProfileId: CURRENT_USER_ID,
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
    res.json((await serializeBattle(battle)) as unknown);
  } catch (error) {
    next(error);
  }
});

router.get("/profile", async (_req, res, next) => {
  try {
    res.json(GetProfileResponse.parse(await currentProfile()));
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", async (req, res, next) => {
  try {
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await currentProfile();
    const [profile] = await db
      .update(profilesTable)
      .set(parsed.data)
      .where(eq(profilesTable.id, CURRENT_USER_ID))
      .returning();
    res.json(UpdateProfileResponse.parse(profile));
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
    res.json(GetLeaderboardResponse.parse(await leaderboard(parsed.data.scope, parsed.data.period)));
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (_req, res, next) => {
  try {
    await currentProfile();
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.profileId, CURRENT_USER_ID))
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