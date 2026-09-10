import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import {
  battleParticipantsTable,
  battleResultsTable,
  battlesTable,
  db,
  notificationsTable,
  pool,
  profilesTable,
  viralRewardEventsTable,
  votesTable,
} from "@workspace/db";
import { levelForXp, settleBattleInTransaction, xpProgress } from "../src/viralCore.ts";

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
    await db.insert(votesTable).values({
      id: ids.vote,
      battleId: ids.battle,
      participantId: ids.winnerEntry,
      voterProfileId: ids.voter,
    });

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
        "code" in error &&
        error.code === "23505",
    );
  });
});