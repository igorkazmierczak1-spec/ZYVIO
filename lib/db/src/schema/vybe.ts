import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, integer, boolean, timestamp, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("vybe_user_role", ["USER", "ADMIN"]);
export const accountStatusEnum = pgEnum("vybe_account_status", ["ACTIVE", "BLOCKED", "DELETED"]);
export const moderationStatusEnum = pgEnum("vybe_moderation_status", ["NEW", "IN_PROGRESS", "RESOLVED", "REJECTED"]);
export const moderationPriorityEnum = pgEnum("vybe_moderation_priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const contentStatusEnum = pgEnum("vybe_content_status", ["ACTIVE", "HIDDEN", "REMOVED"]);

export const profilesTable = pgTable("vybe_profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  status: accountStatusEnum("status").notNull().default("ACTIVE"),
  authProvider: text("auth_provider").notNull().default("clerk"),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").notNull().default("FREE"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  billingPeriod: text("billing_period"),
  currentPeriodStart: integer("current_period_start"),
  currentPeriodEnd: integer("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  language: text("language").notNull().default("en"),
  avatarUrl: text("avatar_url").notNull().default(""),
  bio: text("bio").notNull().default(""),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  rankingPoints: integer("ranking_points").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  rank: integer("rank").notNull().default(0),
  league: text("league").notNull().default("Bronze"),
  streak: integer("streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  activeDays: integer("active_days").notNull().default(0),
  badges: text("badges").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  blockReason: text("block_reason"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const battlesTable = pgTable("vybe_battles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("open"),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  maxParticipants: integer("max_participants").notNull().default(8),
  rewardXp: integer("reward_xp").notNull().default(250),
  coverTone: text("cover_tone").notNull().default("violet"),
  creatorProfileId: text("creator_profile_id"),
  contentStatus: contentStatusEnum("content_status").notNull().default("ACTIVE"),
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
    battleIndex: index("vybe_battle_participants_battle_idx").on(table.battleId),
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
    battleIndex: index("vybe_votes_battle_idx").on(table.battleId),
  }),
);

export const notificationsTable = pgTable(
  "vybe_notifications",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    read: boolean("read").notNull().default(false),
  },
  (table) => ({
    profileCreatedIndex: index("vybe_notifications_profile_created_idx").on(table.profileId, table.createdAt),
  }),
);

export const activitiesTable = pgTable("vybe_activities", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userActivityEventsTable = pgTable(
  "vybe_user_activity_events",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    occurredIndex: index("vybe_user_activity_occurred_idx").on(table.occurredAt),
    profileOccurredIndex: index("vybe_user_activity_profile_occurred_idx").on(table.profileId, table.occurredAt),
  }),
);

export const moderationReportsTable = pgTable(
  "vybe_moderation_reports",
  {
    id: text("id").primaryKey(),
    reporterProfileId: text("reporter_profile_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    description: text("description").notNull().default(""),
    status: moderationStatusEnum("status").notNull().default("NEW"),
    priority: moderationPriorityEnum("priority").notNull().default("MEDIUM"),
    assignedAdminId: text("assigned_admin_id"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCreatedIndex: index("vybe_reports_status_created_idx").on(table.status, table.createdAt),
    targetIndex: index("vybe_reports_target_idx").on(table.targetType, table.targetId),
  }),
);

export const moderationReportHistoryTable = pgTable(
  "vybe_moderation_report_history",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id").notNull(),
    actorProfileId: text("actor_profile_id").notNull(),
    fromStatus: moderationStatusEnum("from_status"),
    toStatus: moderationStatusEnum("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reportCreatedIndex: index("vybe_report_history_report_idx").on(table.reportId, table.createdAt),
  }),
);

export const adminAuditLogsTable = pgTable(
  "vybe_admin_audit_logs",
  {
    id: text("id").primaryKey(),
    actorProfileId: text("actor_profile_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    result: text("result").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdIndex: index("vybe_admin_audit_created_idx").on(table.createdAt),
    actorIndex: index("vybe_admin_audit_actor_idx").on(table.actorProfileId),
  }),
);

export const appSettingsTable = pgTable("vybe_app_settings", {
  id: text("id").primaryKey().default("global"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  registrationsEnabled: boolean("registrations_enabled").notNull().default(true),
  moderationAutoAssign: boolean("moderation_auto_assign").notNull().default(false),
  adminNotificationsEnabled: boolean("admin_notifications_enabled").notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stripeWebhookEventsTable = pgTable("vybe_stripe_webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postsTable = pgTable(
  "vybe_posts",
  {
    id: text("id").primaryKey(),
    authorProfileId: text("author_profile_id").notNull(),
    body: text("body").notNull(),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    category: text("category").notNull().default("General"),
    contentStatus: contentStatusEnum("content_status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authorCreatedIndex: index("vybe_posts_author_created_idx").on(table.authorProfileId, table.createdAt),
    categoryCreatedIndex: index("vybe_posts_category_created_idx").on(table.category, table.createdAt),
  }),
);

export const postLikesTable = pgTable(
  "vybe_post_likes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    profileId: text("profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postProfileUnique: uniqueIndex("vybe_post_likes_post_profile_unique").on(table.postId, table.profileId),
    postIndex: index("vybe_post_likes_post_idx").on(table.postId),
  }),
);

export const commentsTable = pgTable(
  "vybe_comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    authorProfileId: text("author_profile_id").notNull(),
    body: text("body").notNull(),
    contentStatus: contentStatusEnum("content_status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postCreatedIndex: index("vybe_comments_post_created_idx").on(table.postId, table.createdAt),
  }),
);

export const commentLikesTable = pgTable(
  "vybe_comment_likes",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id").notNull(),
    profileId: text("profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    commentProfileUnique: uniqueIndex("vybe_comment_likes_comment_profile_unique").on(table.commentId, table.profileId),
  }),
);

export const followsTable = pgTable(
  "vybe_follows",
  {
    id: text("id").primaryKey(),
    followerProfileId: text("follower_profile_id").notNull(),
    followingProfileId: text("following_profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    followerFollowingUnique: uniqueIndex("vybe_follows_follower_following_unique").on(table.followerProfileId, table.followingProfileId),
    followerIndex: index("vybe_follows_follower_idx").on(table.followerProfileId),
    followingIndex: index("vybe_follows_following_idx").on(table.followingProfileId),
  }),
);

export const blocksTable = pgTable(
  "vybe_blocks",
  {
    id: text("id").primaryKey(),
    blockerProfileId: text("blocker_profile_id").notNull(),
    blockedProfileId: text("blocked_profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    blockerBlockedUnique: uniqueIndex("vybe_blocks_blocker_blocked_unique").on(table.blockerProfileId, table.blockedProfileId),
    blockerIndex: index("vybe_blocks_blocker_idx").on(table.blockerProfileId),
    blockedIndex: index("vybe_blocks_blocked_idx").on(table.blockedProfileId),
  }),
);

export const conversationsTable = pgTable(
  "vybe_conversations",
  {
    id: text("id").primaryKey(),
    participantOneProfileId: text("participant_one_profile_id").notNull(),
    participantTwoProfileId: text("participant_two_profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    participantPairUnique: uniqueIndex("vybe_conversations_participant_pair_unique").on(
      table.participantOneProfileId,
      table.participantTwoProfileId,
    ),
    participantOneIndex: index("vybe_conversations_participant_one_idx").on(table.participantOneProfileId),
    participantTwoIndex: index("vybe_conversations_participant_two_idx").on(table.participantTwoProfileId),
  }),
);

export const messagesTable = pgTable(
  "vybe_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    senderProfileId: text("sender_profile_id").notNull(),
    body: text("body").notNull(),
    contentStatus: contentStatusEnum("content_status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationCreatedIndex: index("vybe_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    senderCreatedIndex: index("vybe_messages_sender_created_idx").on(table.senderProfileId, table.createdAt),
  }),
);

export const aiUsageTable = pgTable(
  "vybe_ai_usage",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    feature: text("feature").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull().default("success"),
    promptCharacters: integer("prompt_characters").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileCreatedIndex: index("vybe_ai_usage_profile_created_idx").on(table.profileId, table.createdAt),
    featureCreatedIndex: index("vybe_ai_usage_feature_created_idx").on(table.feature, table.createdAt),
  }),
);

export const battleResultsTable = pgTable(
  "vybe_battle_results",
  {
    id: text("id").primaryKey(),
    battleId: text("battle_id").notNull(),
    winnerParticipantId: text("winner_participant_id").notNull(),
    loserParticipantId: text("loser_participant_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    battleUnique: uniqueIndex("vybe_battle_results_battle_unique").on(table.battleId),
  }),
);

export const viralRewardEventsTable = pgTable(
  "vybe_viral_reward_events",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    battleId: text("battle_id"),
    kind: text("kind").notNull(),
    xp: integer("xp").notNull().default(0),
    rankingPoints: integer("ranking_points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rewardUnique: uniqueIndex("vybe_viral_reward_unique").on(table.profileId, table.battleId, table.kind),
    profileCreatedIndex: index("vybe_viral_reward_profile_created_idx").on(table.profileId, table.createdAt),
  }),
);

export const insertProfileSchema = createInsertSchema(profilesTable);
export const insertBattleSchema = createInsertSchema(battlesTable);
export const insertParticipantSchema = createInsertSchema(battleParticipantsTable);
export const insertVoteSchema = createInsertSchema(votesTable);
export const insertNotificationSchema = createInsertSchema(notificationsTable);
export const insertActivitySchema = createInsertSchema(activitiesTable);
export const insertUserActivityEventSchema = createInsertSchema(userActivityEventsTable);
export const insertModerationReportSchema = createInsertSchema(moderationReportsTable);
export const insertModerationReportHistorySchema = createInsertSchema(moderationReportHistoryTable);
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogsTable);
export const insertAppSettingsSchema = createInsertSchema(appSettingsTable);
export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEventsTable);
export const insertPostSchema = createInsertSchema(postsTable);
export const insertPostLikeSchema = createInsertSchema(postLikesTable);
export const insertCommentSchema = createInsertSchema(commentsTable);
export const insertCommentLikeSchema = createInsertSchema(commentLikesTable);
export const insertFollowSchema = createInsertSchema(followsTable);
export const insertBlockSchema = createInsertSchema(blocksTable);
export const insertConversationSchema = createInsertSchema(conversationsTable);
export const insertMessageSchema = createInsertSchema(messagesTable);
export const insertAiUsageSchema = createInsertSchema(aiUsageTable);
export const insertBattleResultSchema = createInsertSchema(battleResultsTable);
export const insertViralRewardEventSchema = createInsertSchema(viralRewardEventsTable);

export type Profile = typeof profilesTable.$inferSelect;
export type Battle = typeof battlesTable.$inferSelect;
export type BattleParticipant = typeof battleParticipantsTable.$inferSelect;
export type Vote = typeof votesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
export type UserActivityEvent = typeof userActivityEventsTable.$inferSelect;
export type ModerationReport = typeof moderationReportsTable.$inferSelect;
export type ModerationReportHistory = typeof moderationReportHistoryTable.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
export type AppSettings = typeof appSettingsTable.$inferSelect;
export type StripeWebhookEvent = typeof stripeWebhookEventsTable.$inferSelect;
export type Post = typeof postsTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type PostLike = typeof postLikesTable.$inferSelect;
export type Comment = typeof commentsTable.$inferSelect;
export type CommentLike = typeof commentLikesTable.$inferSelect;
export type Follow = typeof followsTable.$inferSelect;
export type Block = typeof blocksTable.$inferSelect;
export type AiUsage = typeof aiUsageTable.$inferSelect;
export type BattleResult = typeof battleResultsTable.$inferSelect;
export type ViralRewardEvent = typeof viralRewardEventsTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertBattle = z.infer<typeof insertBattleSchema>;