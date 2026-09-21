import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray, like } from "drizzle-orm";
import {
  battleParticipantsTable,
  battleResultsTable,
  battlesTable,
  db,
  notificationsTable,
  pool,
  profilesTable,
  rateLimitBucketsTable,
  viralRewardEventsTable,
  votesTable,
} from "@workspace/db";
import { levelForXp, settleBattleInTransaction, xpProgress } from "../src/viralCore.ts";
import { clearRateLimitBucketsForTests, rateLimit } from "../src/middlewares/rateLimit.ts";
import { uploadedMetadataMatches } from "../src/lib/mediaUpload.ts";
import { PLAN_CONFIG } from "../src/lib/planConfig.ts";
import { utcDayStart } from "../src/lib/planQuota.ts";

const prefix = `viral-test-${crypto.randomUUID()}`;
const ids = {
  winner: `${prefix}-winner`,
  loser: `${prefix}-loser`,
  voter: `${prefix}-voter`,
  battle: `${prefix}-battle`,
  winnerEntry: `${prefix}-winner-entry`,
  loserEntry: `${prefix}-loser-entry`,
  vote: `${prefix}-vote`,
};

after(async () => {
  await db.delete(notificationsTable).where(
    inArray(
      notificationsTable.profileId,
      [ids.winner, ids.loser, ids.voter],
    ),
  );
  await db.delete(viralRewardEventsTable).where(
    inArray(
      viralRewardEventsTable.profileId,
      [ids.winner, ids.loser, ids.voter],
    ),
  );
  await db.delete(battleResultsTable).where(eq(battleResultsTable.battleId, ids.battle));
  await db.delete(votesTable).where(eq(votesTable.battleId, ids.battle));
  await db.delete(battleParticipantsTable).where(eq(battleParticipantsTable.battleId, ids.battle));
  await db.delete(battlesTable).where(eq(battlesTable.id, ids.battle));
  await db.delete(profilesTable).where(
    inArray(profilesTable.id, [ids.winner, ids.loser, ids.voter]),
  );
  await db.delete(rateLimitBucketsTable).where(
    like(rateLimitBucketsTable.key, `${prefix}%`),
  );
  await pool.end();
});

describe("Viral Core calculations", () => {
  test("keeps level and progress deterministic", () => {
    assert.equal(levelForXp(0), 1);
    assert.equal(levelForXp(319), 1);
    assert.equal(levelForXp(320), 2);
    assert.deepEqual(xpProgress(640), {
      level: 3,
      xpForNextLevel: 960,
      progress: 0,
    });
    assert.deepEqual(xpProgress(800), {
      level: 3,
      xpForNextLevel: 960,
      progress: 50,
    });
  });

  test("rate limits repeated requests and exposes retry timing", async () => {
    await clearRateLimitBucketsForTests();
    const limiter = rateLimit({ name: prefix, windowMs: 60_000, max: 2, ipMax: 2 });
    const nextCalls: number[] = [];
    const makeRequest = (profileId = `${prefix}-profile`) => ({
      ip: "127.0.0.1",
      res: { locals: { currentUser: { id: profileId } } },
    });
    const makeResponse = () => ({
      headers: new Map<string, number>(),
      setHeader(name: string, value: number) {
        this.headers.set(name, value);
      },
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    });

    const firstResponse = makeResponse();
    await limiter(makeRequest() as never, firstResponse as never, () => nextCalls.push(1));
    const secondResponse = makeResponse();
    await limiter(makeRequest() as never, secondResponse as never, () => nextCalls.push(1));
    const blockedResponse = makeResponse();

    const otherProfileResponse = makeResponse();
    limiter(makeRequest() as never, blockedResponse as never, () => nextCalls.push(1));

    assert.equal(nextCalls.length, 2);
    assert.equal(blockedResponse.statusCode, 429);
    assert.equal(blockedResponse.headers.has("Retry-After"), true);
  });
});

describe("Centralized plan quota policy", () => {
  test("keeps the Battle and AI limits in one source of truth", () => {
    assert.deepEqual(
      Object.fromEntries(Object.entries(PLAN_CONFIG).map(([plan, config]) => [
        plan,
        { battleCreateDaily: config.limits.battleCreateDaily, aiDaily: config.limits.aiDaily },
      ])),
      {
        FREE: { battleCreateDaily: 3, aiDaily: 3 },
        PREMIUM: { battleCreateDaily: 15, aiDaily: 30 },
        PREMIUM_PRO: { battleCreateDaily: 50, aiDaily: 100 },
      },
    );
    for (const config of Object.values(PLAN_CONFIG)) {
      assert.equal(Object.hasOwn(config.limits, "battleJoinDaily"), false);
      assert.equal(Object.hasOwn(config.limits, "battleVoteDaily"), false);
    }
  });

  test("uses the UTC calendar boundary for daily counting", () => {
    const beforeMidnight = new Date("2025-01-15T23:59:59.999Z");
    const afterMidnight = new Date("2025-01-16T00:00:00.000Z");
    assert.equal(utcDayStart(beforeMidnight).toISOString(), "2025-01-15T00:00:00.000Z");
    assert.equal(utcDayStart(afterMidnight).toISOString(), "2025-01-16T00:00:00.000Z");
  });
});

describe("Media upload completion validation", () => {
  test("requires exact declared content type and byte size", () => {
    const expected = { mediaType: "image" as const, contentType: "image/png", size: 1024 };
    assert.equal(uploadedMetadataMatches(expected, { contentType: "image/png", size: "1024" }), true);
    assert.equal(uploadedMetadataMatches(expected, { contentType: "image/jpeg", size: "1024" }), false);
    assert.equal(uploadedMetadataMatches(expected, { contentType: "image/png", size: "1023" }), false);
  });

  test("enforces the media-kind limits at completion", () => {
    const image = { mediaType: "image" as const, contentType: "image/png", size: 10 * 1024 * 1024 };
    const video = { mediaType: "video" as const, contentType: "video/mp4", size: 100 * 1024 * 1024 };
    assert.equal(uploadedMetadataMatches(image, { contentType: image.contentType, size: image.size }), true);
    assert.equal(uploadedMetadataMatches({ ...image, size: image.size + 1 }, { contentType: image.contentType, size: image.size + 1 }), false);
    assert.equal(uploadedMetadataMatches(video, { contentType: video.contentType, size: video.size }), true);
  });
});

describe("Battle settlement", () => {
  test("settles one 1v1 result with rewards, badges and notifications", async () => {
    const endsAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(profilesTable).values([
      {
        id: ids.winner,
        email: `${ids.winner}@test.invalid`,
        username: ids.winner,
        displayName: "Test Winner",
        country: "PL",
      },
      {
        id: ids.loser,
        email: `${ids.loser}@test.invalid`,
        username: ids.loser,
        displayName: "Test Loser",
        country: "PL",
      },
      {
        id: ids.voter,
        email: `${ids.voter}@test.invalid`,
        username: ids.voter,
        displayName: "Test Voter",
        country: "PL",
      },
    ]);
    await db.insert(battlesTable).values({
      id: ids.battle,
      title: "Automated Viral Core Battle",
      category: "Creativity",
      prompt: "Test prompt",
      endsAt,
      maxParticipants: 2,
      status: "live",
      creatorProfileId: ids.winner,
    });
    await db.insert(battleParticipantsTable).values([
      {
        id: ids.winnerEntry,
        battleId: ids.battle,
        profileId: ids.winner,
        submissionLabel: "Winner entry",
        score: 10,
        votes: 1,
      },
      {
        id: ids.loserEntry,
        battleId: ids.battle,
        profileId: ids.loser,
        submissionLabel: "Loser entry",
        score: 2,
      },
    ]);

    const earlyResult = await db.transaction((tx) =>
      settleBattleInTransaction(tx, ids.battle, ids.voter),
    );
    assert.equal(earlyResult, null);

    await db.update(battlesTable)
      .set({ endsAt: new Date(Date.now() - 1_000) })
      .where(eq(battlesTable.id, ids.battle));
    await db.insert(votesTable).values({
      id: ids.vote,
      battleId: ids.battle,
      participantId: ids.winnerEntry,
      voterProfileId: ids.voter,
    });

    const result = await db.transaction((tx) =>
      settleBattleInTransaction(tx, ids.battle, ids.voter),
    );

    assert.ok(result);
    assert.equal(result?.winnerParticipantId, ids.winnerEntry);
    assert.equal(result?.loserParticipantId, ids.loserEntry);

    const [battle] = await db.select().from(battlesTable).where(eq(battlesTable.id, ids.battle));
    assert.equal(battle?.status, "completed");

    const profiles = await db
      .select()
      .from(profilesTable)
      .where(inArray(profilesTable.id, [ids.winner, ids.loser, ids.voter]));
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    assert.equal(byId.get(ids.winner)?.wins, 1);
    assert.equal(byId.get(ids.winner)?.xp, 250);
    assert.equal(byId.get(ids.winner)?.rankingPoints, 25);
    assert.equal(byId.get(ids.winner)?.badges.includes("First Win"), true);
    assert.equal(byId.get(ids.loser)?.losses, 1);
    assert.equal(byId.get(ids.loser)?.xp, 50);
    assert.equal(byId.get(ids.voter)?.xp, 10);

    const rewards = await db
      .select()
      .from(viralRewardEventsTable)
      .where(inArray(viralRewardEventsTable.profileId, [ids.winner, ids.loser, ids.voter]));
    assert.equal(rewards.length, 3);

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(inArray(notificationsTable.profileId, [ids.winner, ids.loser, ids.voter]));
    assert.equal(notifications.some((notification) => notification.profileId === ids.winner), true);
    assert.equal(notifications.some((notification) => notification.profileId === ids.loser), true);

    const secondResult = await db.transaction((tx) =>
      settleBattleInTransaction(tx, ids.battle, ids.voter),
    );
    assert.equal(secondResult?.id, result?.id);

    const [winnerAfterRetry] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, ids.winner));
    assert.equal(winnerAfterRetry?.wins, 1);
    assert.equal(winnerAfterRetry?.xp, 250);
  });

  test("database rejects a second vote from the same profile in one battle", async () => {
    await assert.rejects(
      db.insert(votesTable).values({
        id: `${ids.vote}-duplicate`,
        battleId: ids.battle,
        participantId: ids.winnerEntry,
        voterProfileId: ids.voter,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "cause" in error &&
        typeof error.cause === "object" &&
        error.cause !== null &&
        "code" in error.cause &&
        error.cause.code === "23505",
    );
  });
});
