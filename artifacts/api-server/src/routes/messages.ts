import { Router, type IRouter } from "express";
import { and, asc, desc, eq, or } from "drizzle-orm";
import {
  blocksTable,
  conversationsTable,
  db,
  messagesTable,
  notificationsTable,
  profilesTable,
} from "@workspace/db";
import { currentUserFrom, requireAuthenticatedUser } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();
router.use(requireAuthenticatedUser);

const messageRateLimit = rateLimit({ name: "social-message-create", windowMs: 5 * 60_000, max: 40 });

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseMessageBody(input: unknown): { body?: string; error?: string } {
  const body = input && typeof input === "object" && typeof (input as Record<string, unknown>).body === "string"
    ? ((input as Record<string, unknown>).body as string).trim()
    : "";
  return body.length >= 1 && body.length <= 2000
    ? { body }
    : { error: "Message must be between 1 and 2,000 characters" };
}

async function blockedProfileIds(profileId: string) {
  const [outgoing, incoming] = await Promise.all([
    db.select({ id: blocksTable.blockedProfileId }).from(blocksTable).where(eq(blocksTable.blockerProfileId, profileId)),
    db.select({ id: blocksTable.blockerProfileId }).from(blocksTable).where(eq(blocksTable.blockedProfileId, profileId)),
  ]);
  return new Set([...outgoing, ...incoming].map((row) => row.id));
}

async function conversationForMember(conversationId: string, profileId: string) {
  const [conversation] = await db.select().from(conversationsTable).where(and(
    eq(conversationsTable.id, conversationId),
    or(
      eq(conversationsTable.participantOneProfileId, profileId),
      eq(conversationsTable.participantTwoProfileId, profileId),
    ),
  )).limit(1);
  return conversation;
}

async function participantView(profileId: string) {
  const [profile] = await db.select({
    id: profilesTable.id,
    username: profilesTable.username,
    displayName: profilesTable.displayName,
    avatarUrl: profilesTable.avatarUrl,
  }).from(profilesTable).where(and(
    eq(profilesTable.id, profileId),
    eq(profilesTable.status, "ACTIVE"),
  )).limit(1);
  return profile;
}

async function messageView(message: typeof messagesTable.$inferSelect) {
  const sender = await participantView(message.senderProfileId);
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: sender ?? {
      id: message.senderProfileId,
      username: "unknown",
      displayName: "VYBE Creator",
      avatarUrl: "",
    },
    body: message.body,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

async function conversationView(
  conversation: typeof conversationsTable.$inferSelect,
  profileId: string,
) {
  const otherProfileId = conversation.participantOneProfileId === profileId
    ? conversation.participantTwoProfileId
    : conversation.participantOneProfileId;
  const [otherParticipant, [lastMessage]] = await Promise.all([
    participantView(otherProfileId),
    db.select().from(messagesTable).where(and(
      eq(messagesTable.conversationId, conversation.id),
      eq(messagesTable.contentStatus, "ACTIVE"),
    )).orderBy(desc(messagesTable.createdAt)).limit(1),
  ]);
  return {
    id: conversation.id,
    otherParticipant: otherParticipant ?? {
      id: otherProfileId,
      username: "unknown",
      displayName: "VYBE Creator",
      avatarUrl: "",
    },
    lastMessage: lastMessage ? await messageView(lastMessage) : null,
    updatedAt: conversation.updatedAt,
  };
}

router.get("/social/conversations", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const conversations = await db.select().from(conversationsTable).where(or(
      eq(conversationsTable.participantOneProfileId, profile.id),
      eq(conversationsTable.participantTwoProfileId, profile.id),
    )).orderBy(desc(conversationsTable.updatedAt));
    res.json(await Promise.all(conversations.map((conversation) => conversationView(conversation, profile.id))));
  } catch (error) {
    next(error);
  }
});

router.post("/social/conversations", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const targetProfileId = typeof req.body?.profileId === "string" ? req.body.profileId.trim() : "";
    if (!targetProfileId || targetProfileId === profile.id) {
      res.status(400).json({ error: "Choose another active profile" });
      return;
    }
    const target = await participantView(targetProfileId);
    if (!target) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if ((await blockedProfileIds(profile.id)).has(target.id)) {
      res.status(403).json({ error: "This profile is not available" });
      return;
    }
    const [participantOneProfileId, participantTwoProfileId] = [profile.id, target.id].sort();
    let [conversation] = await db.select().from(conversationsTable).where(and(
      eq(conversationsTable.participantOneProfileId, participantOneProfileId),
      eq(conversationsTable.participantTwoProfileId, participantTwoProfileId),
    )).limit(1);
    if (!conversation) {
      [conversation] = await db.insert(conversationsTable).values({
        id: `conversation-${crypto.randomUUID()}`,
        participantOneProfileId,
        participantTwoProfileId,
      }).returning();
    }
    res.status(201).json(await conversationView(conversation, profile.id));
  } catch (error) {
    next(error);
  }
});

router.get("/social/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const conversationId = routeParam(req.params.conversationId);
    const conversation = await conversationForMember(conversationId, profile.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const pageSize = 100;
    const rows = await db.select().from(messagesTable).where(and(
      eq(messagesTable.conversationId, conversation.id),
      eq(messagesTable.contentStatus, "ACTIVE"),
    )).orderBy(desc(messagesTable.createdAt)).limit(pageSize + 1);
    const hasMore = rows.length > pageSize;
    const items = await Promise.all(rows.slice(0, pageSize).reverse().map(messageView));
    res.json({ items, page: 1, hasMore });
  } catch (error) {
    next(error);
  }
});

router.post("/social/conversations/:conversationId/messages", messageRateLimit, async (req, res, next) => {
  try {
    const profile = currentUserFrom(res);
    const conversation = await conversationForMember(routeParam(req.params.conversationId), profile.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const recipientProfileId = conversation.participantOneProfileId === profile.id
      ? conversation.participantTwoProfileId
      : conversation.participantOneProfileId;
    if ((await blockedProfileIds(profile.id)).has(recipientProfileId)) {
      res.status(403).json({ error: "Messaging is unavailable for this profile" });
      return;
    }
    const parsed = parseMessageBody(req.body);
    if (!parsed.body) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [message] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(messagesTable).values({
        id: `message-${crypto.randomUUID()}`,
        conversationId: conversation.id,
        senderProfileId: profile.id,
        body: parsed.body,
      }).returning();
      await tx.update(conversationsTable).set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, conversation.id));
      await tx.insert(notificationsTable).values({
        id: `notification-${crypto.randomUUID()}`,
        profileId: recipientProfileId,
        kind: "message",
        title: "New message",
        body: `${profile.displayName} sent you a message.`,
      });
      return [created];
    });
    if (!message) {
      res.status(500).json({ error: "Message could not be created" });
      return;
    }
    res.status(201).json(await messageView(message));
  } catch (error) {
    next(error);
  }
});

export default router;