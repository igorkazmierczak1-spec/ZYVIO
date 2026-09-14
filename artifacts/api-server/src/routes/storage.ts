import { Readable } from "node:stream";
import { and, eq, isNull, or } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { attachmentsTable, battlesTable, commentsTable, conversationsTable, db, messagesTable, postsTable, profilesTable } from "@workspace/db";
import { RequestMediaUploadUrlBody, RequestMediaUploadUrlResponse } from "@workspace/api-zod";
import { currentUserFrom, requireAuthenticatedUser } from "../middlewares/auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { setObjectAclPolicy } from "../lib/objectAcl";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, uploadedMetadataMatches } from "../lib/mediaUpload";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const MIME_TYPES = new Map<string, "image" | "video">([
  ["image/jpeg", "image"], ["image/png", "image"], ["image/gif", "image"], ["image/webp", "image"], ["image/avif", "image"],
  ["image/heic", "image"], ["image/heif", "image"],
  ["video/mp4", "video"], ["video/webm", "video"], ["video/quicktime", "video"], ["video/3gpp", "video"],
  ["video/mpeg", "video"], ["video/ogg", "video"],
]);

function safeName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255) || "upload";
}

function objectUrl(objectPath: string) {
  return `/api/storage${objectPath}`;
}

function mediaView(attachment: typeof attachmentsTable.$inferSelect) {
  return {
    id: attachment.id,
    url: objectUrl(attachment.objectPath),
    mediaType: attachment.mediaType,
    contentType: attachment.contentType,
    size: attachment.size,
    originalName: attachment.originalName,
  };
}

router.post("/storage/uploads/request-url", requireAuthenticatedUser, async (req, res, next) => {
  try {
    const parsed = RequestMediaUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "name, size and contentType are required" });
      return;
    }
    const contentType = parsed.data.contentType.toLowerCase().trim();
    const mediaType = MIME_TYPES.get(contentType);
    const maxSize = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!mediaType || !Number.isSafeInteger(parsed.data.size) || parsed.data.size < 1 || parsed.data.size > maxSize) {
      res.status(400).json({
        error: mediaType === "video"
          ? "Unsupported video type or video exceeds the 100 MB limit"
          : "Unsupported image type or image exceeds the 10 MB limit",
      });
      return;
    }
    const profile = currentUserFrom(res);
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    const [attachment] = await db.insert(attachmentsTable).values({
      id: `attachment-${crypto.randomUUID()}`,
      ownerProfileId: profile.id,
      objectPath,
      originalName: safeName(parsed.data.name),
      contentType,
      mediaType,
      size: parsed.data.size,
    }).returning();
    if (!attachment) throw new Error("Attachment could not be created");
    res.json(RequestMediaUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      attachmentId: attachment.id,
      metadata: {
        name: attachment.originalName,
        size: attachment.size,
        contentType: attachment.contentType,
        mediaType: attachment.mediaType,
      },
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/storage/uploads/complete", requireAuthenticatedUser, async (req, res, next) => {
  try {
    const attachmentId = typeof req.body?.attachmentId === "string" ? req.body.attachmentId : "";
    const profile = currentUserFrom(res);
    const [attachment] = await db.select().from(attachmentsTable).where(and(
      eq(attachmentsTable.id, attachmentId),
      eq(attachmentsTable.ownerProfileId, profile.id),
      eq(attachmentsTable.uploadStatus, "pending"),
    )).limit(1);
    if (!attachment) {
      res.status(404).json({ error: "Upload not found or not owned by you" });
      return;
    }
    const { file, metadata } = await storage.getObjectEntityMetadata(attachment.objectPath);
    if (!uploadedMetadataMatches(attachment, metadata)) {
      try {
        await storage.deleteObjectEntity(attachment.objectPath);
      } catch {
        // Do not leak storage details. The attachment remains pending so a
        // later cleanup can retry deletion, but it is never marked uploaded.
      }
      res.status(409).json({ error: "Uploaded object metadata does not match the declared upload" });
      return;
    }
    await setObjectAclPolicy(file, { owner: profile.id, visibility: "private" });
    const [updated] = await db.update(attachmentsTable).set({ uploadStatus: "uploaded", updatedAt: new Date() })
      .where(eq(attachmentsTable.id, attachment.id)).returning();
    res.json(mediaView(updated ?? attachment));
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(409).json({ error: "Upload bytes were not found in object storage" });
      return;
    }
    next(error);
  }
});

router.delete("/storage/uploads/:attachmentId", requireAuthenticatedUser, async (req, res, next) => {
  try {
    const attachmentId = typeof req.params.attachmentId === "string" ? req.params.attachmentId : "";
    const profile = currentUserFrom(res);
    const [attachment] = await db.select().from(attachmentsTable).where(and(
      eq(attachmentsTable.id, attachmentId),
      eq(attachmentsTable.ownerProfileId, profile.id),
      // A claimed attachment is content, not a cancellable upload.
      // `deleting` is used below to close the claim/delete race.
      or(eq(attachmentsTable.uploadStatus, "pending"), eq(attachmentsTable.uploadStatus, "uploaded")),
    )).limit(1);
    if (!attachment || attachment.targetType || attachment.targetId) {
      res.status(404).json({ error: "Unattached upload not found or not owned by you" });
      return;
    }

    const [deleting] = await db.update(attachmentsTable).set({
      uploadStatus: "deleting",
      updatedAt: new Date(),
    }).where(and(
      eq(attachmentsTable.id, attachment.id),
      eq(attachmentsTable.ownerProfileId, profile.id),
      or(eq(attachmentsTable.uploadStatus, "pending"), eq(attachmentsTable.uploadStatus, "uploaded")),
    )).returning();
    if (!deleting) {
      res.status(409).json({ error: "Upload is no longer available for cancellation" });
      return;
    }

    try {
      await storage.deleteObjectEntity(attachment.objectPath);
    } catch (error) {
      await db.update(attachmentsTable).set({ uploadStatus: attachment.uploadStatus, updatedAt: new Date() })
        .where(eq(attachmentsTable.id, attachment.id));
      throw error;
    }
    await db.delete(attachmentsTable).where(and(
      eq(attachmentsTable.id, attachment.id),
      eq(attachmentsTable.ownerProfileId, profile.id),
      eq(attachmentsTable.uploadStatus, "deleting"),
      // Keep deletion scoped to unattached rows even if a future caller adds
      // another attachment state.
      isNull(attachmentsTable.targetType),
      isNull(attachmentsTable.targetId),
    ));
    res.status(204).end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(204).end();
      return;
    }
    next(error);
  }
});

router.get("/storage/public-objects/*filePath", async (req, res, next) => {
  try {
    const raw = req.params.filePath;
    const file = await storage.searchPublicObject(Array.isArray(raw) ? raw.join("/") : raw);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await storage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    next(error);
  }
});

async function canServeAttachment(attachment: typeof attachmentsTable.$inferSelect, profileId: string) {
  if (attachment.uploadStatus !== "uploaded") return attachment.ownerProfileId === profileId;
  if (!attachment.targetType || !attachment.targetId) return attachment.ownerProfileId === profileId;
  if (attachment.targetType === "PROFILE") {
    const [profile] = await db.select({ id: profilesTable.id }).from(profilesTable)
      .where(and(eq(profilesTable.id, attachment.targetId), eq(profilesTable.status, "ACTIVE"))).limit(1);
    return Boolean(profile);
  }
  if (attachment.targetType === "POST") {
    const [post] = await db.select({ id: postsTable.id }).from(postsTable)
      .where(and(eq(postsTable.id, attachment.targetId), eq(postsTable.contentStatus, "ACTIVE"))).limit(1);
    return Boolean(post);
  }
  if (attachment.targetType === "COMMENT") {
    const [comment] = await db.select({ id: commentsTable.id }).from(commentsTable)
      .where(and(eq(commentsTable.id, attachment.targetId), eq(commentsTable.contentStatus, "ACTIVE"))).limit(1);
    return Boolean(comment);
  }
  if (attachment.targetType === "BATTLE") {
    const [battle] = await db.select({ id: battlesTable.id }).from(battlesTable)
      .where(and(eq(battlesTable.id, attachment.targetId), eq(battlesTable.contentStatus, "ACTIVE"))).limit(1);
    return Boolean(battle);
  }
  if (attachment.targetType === "MESSAGE") {
    const [message] = await db.select({ conversationId: messagesTable.conversationId }).from(messagesTable)
      .where(and(eq(messagesTable.id, attachment.targetId), eq(messagesTable.contentStatus, "ACTIVE"))).limit(1);
    if (!message) return false;
    const [conversation] = await db.select({ id: conversationsTable.id }).from(conversationsTable).where(and(
      eq(conversationsTable.id, message.conversationId),
      or(eq(conversationsTable.participantOneProfileId, profileId), eq(conversationsTable.participantTwoProfileId, profileId)),
    )).limit(1);
    return Boolean(conversation);
  }
  return false;
}

router.get("/storage/objects/*path", requireAuthenticatedUser, async (req: Request, res: Response, next) => {
  try {
    const raw = req.params.path;
    const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
    const profile = currentUserFrom(res);
    const [attachment] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.objectPath, objectPath)).limit(1);
    if (!attachment || !(await canServeAttachment(attachment, profile.id))) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    next(error);
  }
});

export { mediaView };
export default router;