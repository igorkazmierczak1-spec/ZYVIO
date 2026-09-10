import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("vybe_user_role", ["USER", "ADMIN"]);

export const profilesTable = pgTable("vybe_profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  authProvider: text("auth_provider").notNull().default("clerk"),
  language: text("language").notNull().default("en"),
  avatarUrl: text("avatar_url").notNull().default(""),
  bio: text("bio").notNull().default(""),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  rank: integer("rank").notNull().default(0),
  league: text("league").notNull().default("Bronze"),
  streak: integer("streak").notNull().default(0),
  badges: text("badges").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const battlesTable = pgTable("vybe_battles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("open"),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  maxParticipants: integer("max_participants").notNull().default(8),
  rewardXp: integer("reward_xp").notNull().default(250),
  coverTone: text("cover_tone").notNull().default("violet"),
});

export const battleParticipantsTable = pgTable(
  "vybe_battle_participants",
  {
    id: text("id").primaryKey(),
    battleId: text("battle_id").notNull(),
    profileId: text("profile_id").notNull(),
    submissionLabel: text("submission_label").notNull(),
    score: integer("score").notNull().default(0),
    votes: integer("votes").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    battleProfileUnique: uniqueIndex("vybe_battle_profile_unique").on(
      table.battleId,
      table.profileId,
    ),
  }),
);

export const votesTable = pgTable(
  "vybe_votes",
  {
    id: text("id").primaryKey(),
    battleId: text("battle_id").notNull(),
    participantId: text("participant_id").notNull(),
    voterProfileId: text("voter_profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    voterBattleUnique: uniqueIndex("vybe_voter_battle_unique").on(
      table.battleId,
      table.voterProfileId,
    ),
  }),
);

export const notificationsTable = pgTable("vybe_notifications", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  read: boolean("read").notNull().default(false),
});

export const activitiesTable = pgTable("vybe_activities", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable);
export const insertBattleSchema = createInsertSchema(battlesTable);
export const insertParticipantSchema = createInsertSchema(battleParticipantsTable);
export const insertVoteSchema = createInsertSchema(votesTable);
export const insertNotificationSchema = createInsertSchema(notificationsTable);
export const insertActivitySchema = createInsertSchema(activitiesTable);

export type Profile = typeof profilesTable.$inferSelect;
export type Battle = typeof battlesTable.$inferSelect;
export type BattleParticipant = typeof battleParticipantsTable.$inferSelect;
export type Vote = typeof votesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertBattle = z.infer<typeof insertBattleSchema>;