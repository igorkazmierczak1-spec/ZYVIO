import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, inArray, notInArray, or } from "drizzle-orm";
import {
  blocksTable,
  commentsTable,
  commentLikesTable,
  db,
  followsTable,
  notificationsTable,
  postLikesTable,
  postsTable,
  profilesTable,
} from "@workspace/db";
import { attachmentsFor, claimAttachment } from "../lib/media";
import { currentUserFrom, requireAuthenticatedUser } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { getUserPlan } from "../lib/premium";
import { assertDailyPlanQuota, sendPlanQuotaError } from "../lib/planQuota";
import { planConfigFor } from "../lib/planConfig";

const router: IRouter = Router();
router.use(requireAuthenticatedUser);

type FeedQuery = {
  filter: "for-you" | "following" | "trending" | "latest";
  category?: string;
  page: number;
};
type PostInput = {
  body: string;
  attachmentId?: string | null;
  category: string;
};

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseFeedQuery(input: Record<string, unknown>): { data?: FeedQuery; error?: string } {
  const rawFilter = typeof input.filter === "string" ? input.filter : "for-you";
  const filter = ["for-you", "following", "trending", "latest"].includes(rawFilter)
    ? rawFilter as FeedQuery["filter"]
    : null;
  const rawPage = typeof input.page === "string" ? Number(input.page) : 1;
  const category = typeof input.category === "string" ? input.category.trim() : undefined;
  if (!filter || !Number.isInteger(rawPage) || rawPage < 1 || rawPage > 1000) {
    return { error: "Invalid feed query" };
  }
  if (category !== undefined && (category.length < 1 || category.length > 40)) {
    return { error: "Invalid category" };
  }
  return { data: { filter, page: rawPage, category } };
}

function parsePostBody(input: unknown): { data?: PostInput; error?: string } {
  if (!input || typeof input !== "object") return { error: "Post body is required" };
  const value = input as Record<string, unknown>;
  if ("mediaUrl" in value || "mediaType" in value) return { error: "External media fields are not accepted" };
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const category = typeof value.category === "string" && value.category.trim()
    ? value.category.trim()
    : "General";
  const attachmentId = value.attachmentId === null || value.attachmentId === undefined
    ? null
    : typeof value.attachmentId === "string" ? value.attachmentId : undefined;
  if (body.length < 1 || body.length > 2000 || category.length > 40 || attachmentId === undefined) {
    return { error: "Invalid post body" };
  }
  return { data: { body, category, attachmentId } };
}

function parseCommentBody(input: unknown): { data?: { body: string; attachmentId?: string | null }; error?: string } {
  const attachmentId = input && typeof input === "object" && ((input as Record<string, unknown>).attachmentId === null || typeof (input as Record<string, unknown>).attachmentId === "string")
    ? (input as Record<string, unknown>).attachmentId as string | null | undefined
    : undefined;
  const body = input && typeof input === "object" && typeof (input as Record<string, unknown>).body === "string"
    ? ((input as Record<string, unknown>).body as string).trim()
    : "";
  return (body.length >= 1 && body.length <= 500) || (body.length === 0 && Boolean(attachmentId))
    ? { data: { body, attachmentId } }
    : { error: "Invalid comment body" };
}

const createPostRateLimit = rateLimit({ name: "social-post-create", windowMs: 10 * 60_000, max: 10 });
const commentRateLimit = rateLimit({ name: "social-comment-create", windowMs: 5 * 60_000, max: 20 });
const followRateLimit = rateLimit({ name: "social-follow", windowMs: 10 * 60_000, max: 30 });
const likeRateLimit = rateLimit({ name: "social-like", windowMs: 60_000, max: 60 });

async function blockedProfileIds(profileId: string) {
  const [outgoing, incoming] = await Promise.all([
    db.select({ id: blocksTable.blockedProfileId }).from(blocksTable).where(eq(blocksTable.blockerProfileId, profileId)),
    db.select({ id: blocksTable.blockerProfileId }).from(blocksTable).where(eq(blocksTable.blockedProfileId, profileId)),
  ]);
  return [...new Set([...outgoing, ...incoming].map((row) => row.id))];
}

async function notify(
  profileId: string,
  kind: string,
  title: string,
  body: string,
  target?: { targetType: string; targetId: string },
  executor: any = db,
) {
  await executor.insert(notificationsTable).values({
    id: `notification-${crypto.randomUUID()}`,
    profileId,
    kind,
    title,
    body,
    targetType: target?.targetType,
    targetId: target?.targetId,
  });
}

async function postView(post: typeof postsTable.$inferSelect, currentProfileId: string) {
  const [[author], [likes], [comments], [liked]] = await Promise.all([
    db.select({
      id: profilesTable.id,
      username: profilesTable.username,
      displayName: profilesTable.displayName,
      avatarUrl: profilesTable.avatarUrl,
      country: profilesTable.country,
    }).from(profilesTable).where(eq(profilesTable.id, post.authorProfileId)).limit(1),
    db.select({ count: count() }).from(postLikesTable).where(eq(postLikesTable.postId, post.id)),
    db.select({ count: count() }).from(commentsTable).where(and(eq(commentsTable.postId, post.id), eq(commentsTable.contentStatus, "ACTIVE"))),
    db.select({ id: postLikesTable.id }).from(postLikesTable).where(and(eq(postLikesTable.postId, post.id), eq(postLikesTable.profileId, currentProfileId))).limit(1),
  ]);
  const attachments = await attachmentsFor("POST", post.id);
  return {
    id: post.id,
    author: author ?? {
      id: post.authorProfileId,
      username: "unknown",
      displayName: "ZYVIO Creator",
      avatarUrl: "",
      country: "",
    },
    body: post.body,
    mediaUrl: attachments[0]?.url ?? null,
    mediaType: attachments[0]?.mediaType ?? null,
    category: post.category,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likeCount: Number(likes?.count ?? 0),
    commentCount: Number(comments?.count ?? 0),
    liked: Boolean(liked),
    attachments,
  };
}

async function getPostForUser(postId: string, profileId: string) {
  const blocked = await blockedProfileIds(profileId);
  const filters = [
    eq(postsTable.id, postId),
    eq(postsTable.contentStatus, "ACTIVE"),
    ...(blocked.length ? [notInArray(postsTable.authorProfileId, blocked)] : []),
  ];
  const [post] = await db.select().from(postsTable).where(and(...filters)).limit(1);
  return post;
}

router.get("/social/feed", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const parsedQuery = parseFeedQuery(req.query as Record<string, unknown>);
    if (!parsedQuery.data) {
      res.status(400).json({ error: parsedQuery.error });
      return;
    }
    const query = parsedQuery.data;
    const blocked = await blockedProfileIds(profile.id);
    const filters = [
      eq(postsTable.contentStatus, "ACTIVE"),
      ...(blocked.length ? [notInArray(postsTable.authorProfileId, blocked)] : []),
    ];
    if (query.category) filters.push(eq(postsTable.category, query.category));
    if (query.filter === "following") {
      const following = await db.select({ id: followsTable.followingProfileId }).from(followsTable).where(eq(followsTable.followerProfileId, profile.id));
      const ids = following.map((row) => row.id).filter((id) => !blocked.includes(id));
      if (!ids.length) {
        res.json({ items: [], page: query.page, hasMore: false });
        return;
      }
      filters.push(inArray(postsTable.authorProfileId, ids));
    }
    const pageSize = 20;
    const rows = await db.select().from(postsTable)
      .where(and(...filters))
      .orderBy(query.filter === "trending" ? desc(postsTable.updatedAt) : desc(postsTable.createdAt))
      .limit(pageSize + 1)
      .offset((query.page - 1) * pageSize);
    const hasMore = rows.length > pageSize;
    const items = await Promise.all(rows.slice(0, pageSize).map((post) => postView(post, profile.id)));
    res.json({ items, page: query.page, hasMore });
  } catch (error) {
    next(error);
  }
});

router.get("/social/posts/:postId", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const post = await getPostForUser(routeParam(req.params.postId), profile.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(await postView(post, profile.id));
  } catch (error) {
    next(error);
  }
});

router.post("/social/posts", createPostRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const plan = await getUserPlan(profile.id);
    await assertDailyPlanQuota(profile.id, plan, "postCreate");
    const parsed = parsePostBody(req.body);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { attachmentId, ...postFields } = parsed.data;
    const post = await db.transaction(async (tx) => {
      const postId = `post-${crypto.randomUUID()}`;
      if (attachmentId) await claimAttachment(attachmentId, profile.id, "POST", postId, tx);
      const [created] = await tx.insert(postsTable).values({
        id: postId,
        authorProfileId: profile.id,
        ...postFields,
      }).returning();
      return created;
    }).catch((error) => {
      if (error instanceof Error && error.message === "MEDIA_ATTACHMENT_NOT_OWNED") return undefined;
      throw error;
    });
    if (!post) {
      res.status(400).json({ error: "Invalid media attachment" });
      return;
    }
    res.status(201).json(await postView(post, profile.id));
  } catch (error) {
    if (sendPlanQuotaError(error, res)) return;
    next(error);
  }
});

router.patch("/social/posts/:postId", createPostRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const parsed = parsePostBody(req.body);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { attachmentId, ...postFields } = parsed.data;
    const postId = routeParam(req.params.postId);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(postsTable).where(and(
        eq(postsTable.id, postId),
        eq(postsTable.authorProfileId, profile.id),
        eq(postsTable.contentStatus, "ACTIVE"),
      )).limit(1);
      if (!existing) return { missing: true as const };
      if (attachmentId) await claimAttachment(attachmentId, profile.id, "POST", existing.id, tx);
      const [updated] = await tx.update(postsTable).set({
        ...postFields,
        updatedAt: new Date(),
      }).where(eq(postsTable.id, existing.id)).returning();
      return { post: updated };
    }).catch((error) => {
      if (error instanceof Error && error.message === "MEDIA_ATTACHMENT_NOT_OWNED") return { invalid: true as const };
      throw error;
    });
    if ("missing" in result) {
      res.status(404).json({ error: "Post not found or not owned by you" });
      return;
    }
    if ("invalid" in result || !result.post) {
      res.status(400).json({ error: "Invalid media attachment" });
      return;
    }
    const post = result.post;
    res.json(await postView(post, profile.id));
  } catch (error) {
    next(error);
  }
});

router.delete("/social/posts/:postId", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const [post] = await db.update(postsTable).set({ contentStatus: "REMOVED", updatedAt: new Date() })
      .where(and(eq(postsTable.id, routeParam(req.params.postId)), eq(postsTable.authorProfileId, profile.id), eq(postsTable.contentStatus, "ACTIVE"))).returning();
    if (!post) {
      res.status(404).json({ error: "Post not found or not owned by you" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/social/posts/:postId/like", likeRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const post = await getPostForUser(routeParam(req.params.postId), profile.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const [like] = await db.insert(postLikesTable).values({
      id: `post-like-${crypto.randomUUID()}`,
      postId: post.id,
      profileId: profile.id,
    }).onConflictDoNothing().returning();
    if (like && post.authorProfileId !== profile.id) {
      await notify(post.authorProfileId, "like", "Someone liked your post", `${profile.displayName} liked your post.`, {
        targetType: "POST",
        targetId: post.id,
      });
    }
    res.json(await postView(post, profile.id));
  } catch (error) {
    next(error);
  }
});

router.delete("/social/posts/:postId/like", likeRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const post = await getPostForUser(routeParam(req.params.postId), profile.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, post.id), eq(postLikesTable.profileId, profile.id)));
    res.json(await postView(post, profile.id));
  } catch (error) {
    next(error);
  }
});

router.get("/social/posts/:postId/comments", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const post = await getPostForUser(routeParam(req.params.postId), profile.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const blocked = await blockedProfileIds(profile.id);
    const rows = await db.select({
      id: commentsTable.id,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      author: {
        id: profilesTable.id,
        username: profilesTable.username,
        displayName: profilesTable.displayName,
        avatarUrl: profilesTable.avatarUrl,
      },
    }).from(commentsTable).innerJoin(profilesTable, eq(profilesTable.id, commentsTable.authorProfileId))
      .where(and(
        eq(commentsTable.postId, post.id),
        eq(commentsTable.contentStatus, "ACTIVE"),
        ...(blocked.length ? [notInArray(commentsTable.authorProfileId, blocked)] : []),
      ))
      .orderBy(asc(commentsTable.createdAt));
    res.json(await Promise.all(rows.map(async (row) => {
      const attachments = await attachmentsFor("COMMENT", row.id);
      return {
        ...row,
        mediaUrl: attachments[0]?.url ?? null,
        mediaType: attachments[0]?.mediaType ?? null,
        attachments,
      };
    })));
  } catch (error) {
    next(error);
  }
});

router.post("/social/posts/:postId/comments", commentRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const plan = await getUserPlan(profile.id);
    await assertDailyPlanQuota(profile.id, plan, "commentCreate");
    const post = await getPostForUser(routeParam(req.params.postId), profile.id);
    const parsed = parseCommentBody(req.body);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const commentInput = parsed.data;
    const comment = await db.transaction(async (tx) => {
      const commentId = `comment-${crypto.randomUUID()}`;
      if (commentInput.attachmentId) await claimAttachment(commentInput.attachmentId, profile.id, "COMMENT", commentId, tx);
      const [created] = await tx.insert(commentsTable).values({
        id: commentId,
        postId: post.id,
        authorProfileId: profile.id,
        body: commentInput.body,
      }).returning();
      if (!created) throw new Error("Comment could not be created");
      if (post.authorProfileId !== profile.id) {
        await notify(post.authorProfileId, "comment", "New comment on your post", `${profile.displayName} commented on your post.`, {
          targetType: "POST",
          targetId: post.id,
        }, tx);
      }
      return created;
    }).catch((error) => {
      if (error instanceof Error && error.message === "MEDIA_ATTACHMENT_NOT_OWNED") return undefined;
      throw error;
    });
    if (!comment) {
      res.status(400).json({ error: "Invalid media attachment" });
      return;
    }
    const attachments = await attachmentsFor("COMMENT", comment.id);
    res.status(201).json({
      id: comment.id,
      body: comment.body,
      mediaUrl: attachments[0]?.url ?? null,
      mediaType: attachments[0]?.mediaType ?? null,
      createdAt: comment.createdAt,
      author: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      attachments,
    });
  } catch (error) {
    if (sendPlanQuotaError(error, res)) return;
    next(error);
  }
});

router.delete("/social/comments/:commentId", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const [comment] = await db.update(commentsTable).set({ contentStatus: "REMOVED", updatedAt: new Date() })
      .where(and(eq(commentsTable.id, routeParam(req.params.commentId)), eq(commentsTable.authorProfileId, profile.id), eq(commentsTable.contentStatus, "ACTIVE"))).returning();
    if (!comment) {
      res.status(404).json({ error: "Comment not found or not owned by you" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/social/users/:profileId/follow", followRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const targetProfileId = routeParam(req.params.profileId);
    if (profile.id === targetProfileId) {
      res.status(400).json({ error: "You cannot follow yourself" });
      return;
    }
    const [target] = await db.select().from(profilesTable).where(and(eq(profilesTable.id, targetProfileId), eq(profilesTable.status, "ACTIVE"))).limit(1);
    if (!target) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const blocked = await blockedProfileIds(profile.id);
    if (blocked.includes(target.id)) {
      res.status(403).json({ error: "This profile is not available" });
      return;
    }
    const [follow] = await db.insert(followsTable).values({
      id: `follow-${crypto.randomUUID()}`,
      followerProfileId: profile.id,
      followingProfileId: target.id,
    }).onConflictDoNothing().returning();
    if (follow) {
       await notify(target.id, "follow", "New follower", `${profile.displayName} started following you.`, {
         targetType: "PROFILE",
         targetId: profile.id,
       });
    }
    res.json({ following: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/social/users/:profileId/follow", followRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const targetProfileId = routeParam(req.params.profileId);
    if (profile.id === targetProfileId) {
      res.status(400).json({ error: "You cannot unfollow yourself" });
      return;
    }
    await db.delete(followsTable).where(and(eq(followsTable.followerProfileId, profile.id), eq(followsTable.followingProfileId, targetProfileId)));
    res.json({ following: false });
  } catch (error) {
    next(error);
  }
});

router.get("/social/users/:profileId", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const blocked = await blockedProfileIds(profile.id);
    const targetProfileId = routeParam(req.params.profileId);
    if (blocked.includes(targetProfileId)) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const [target] = await db.select({
      id: profilesTable.id,
      username: profilesTable.username,
      displayName: profilesTable.displayName,
      avatarUrl: profilesTable.avatarUrl,
      bio: profilesTable.bio,
      country: profilesTable.country,
      level: profilesTable.level,
      xp: profilesTable.xp,
      rankingPoints: profilesTable.rankingPoints,
      wins: profilesTable.wins,
      losses: profilesTable.losses,
      rank: profilesTable.rank,
      league: profilesTable.league,
      streak: profilesTable.streak,
      badges: profilesTable.badges,
      plan: profilesTable.plan,
    }).from(profilesTable).where(and(eq(profilesTable.id, targetProfileId), eq(profilesTable.status, "ACTIVE"))).limit(1);
    if (!target) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const [[followers], [following], [isFollowing], [isBlocked]] = await Promise.all([
      db.select({ count: count() }).from(followsTable).where(eq(followsTable.followingProfileId, target.id)),
      db.select({ count: count() }).from(followsTable).where(eq(followsTable.followerProfileId, target.id)),
      db.select({ id: followsTable.id }).from(followsTable).where(and(eq(followsTable.followerProfileId, profile.id), eq(followsTable.followingProfileId, target.id))).limit(1),
      db.select({ id: blocksTable.id }).from(blocksTable).where(and(eq(blocksTable.blockerProfileId, profile.id), eq(blocksTable.blockedProfileId, target.id))).limit(1),
    ]);
    res.json({
      ...target,
      planBadge: planConfigFor(target.plan === "PREMIUM_PRO" ? "PREMIUM_PRO" : target.plan === "PREMIUM" ? "PREMIUM" : "FREE").badge,
      winRate: target.wins + target.losses ? Math.round((target.wins / (target.wins + target.losses)) * 100) : 0,
      followerCount: Number(followers?.count ?? 0),
      followingCount: Number(following?.count ?? 0),
      isFollowing: Boolean(isFollowing),
      isBlocked: Boolean(isBlocked),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/social/users/:profileId/block", followRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const targetProfileId = routeParam(req.params.profileId);
    if (profile.id === targetProfileId) {
      res.status(400).json({ error: "You cannot block yourself" });
      return;
    }
    const [target] = await db.select({ id: profilesTable.id }).from(profilesTable).where(and(eq(profilesTable.id, targetProfileId), eq(profilesTable.status, "ACTIVE"))).limit(1);
    if (!target) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.insert(blocksTable).values({
        id: `block-${crypto.randomUUID()}`,
        blockerProfileId: profile.id,
        blockedProfileId: target.id,
      }).onConflictDoNothing();
      await tx.delete(followsTable).where(or(
        and(eq(followsTable.followerProfileId, profile.id), eq(followsTable.followingProfileId, target.id)),
        and(eq(followsTable.followerProfileId, target.id), eq(followsTable.followingProfileId, profile.id)),
      ));
    });
    res.json({ blocked: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/social/users/:profileId/block", followRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    await db.delete(blocksTable).where(and(eq(blocksTable.blockerProfileId, profile.id), eq(blocksTable.blockedProfileId, routeParam(req.params.profileId))));
    res.json({ blocked: false });
  } catch (error) {
    next(error);
  }
});

export default router;