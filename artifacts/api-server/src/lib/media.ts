import { and, desc, eq, isNull } from "drizzle-orm";
import { attachmentsTable, db } from "@workspace/db";

export type MediaTarget = "PROFILE" | "POST" | "COMMENT" | "MESSAGE" | "BATTLE";

export function mediaUrl(objectPath: string) {
  return `/api/storage${objectPath}`;
}

export function serializeAttachment(attachment: typeof attachmentsTable.$inferSelect) {
  return {
    id: attachment.id,
    url: mediaUrl(attachment.objectPath),
    mediaType: attachment.mediaType,
    contentType: attachment.contentType,
    size: attachment.size,
    originalName: attachment.originalName,
  };
}

export async function attachmentsFor(targetType: MediaTarget, targetId: string) {
  const rows = await db.select().from(attachmentsTable).where(and(
    eq(attachmentsTable.targetType, targetType),
    eq(attachmentsTable.targetId, targetId),
    eq(attachmentsTable.uploadStatus, "uploaded"),
  )).orderBy(desc(attachmentsTable.createdAt));
  return rows.map(serializeAttachment);
}

/**
 * Claims only an uploaded object owned by the authenticated profile. A claim
 * is immutable once linked, preventing an object path from being reused on a
 * different author's content.
 */
export async function claimAttachment(
  attachmentId: string | null | undefined,
  ownerProfileId: string,
  targetType: MediaTarget,
  targetId: string,
) {
  if (!attachmentId) return null;
  const [attachment] = await db.select().from(attachmentsTable).where(and(
    eq(attachmentsTable.id, attachmentId),
    eq(attachmentsTable.ownerProfileId, ownerProfileId),
    eq(attachmentsTable.uploadStatus, "uploaded"),
  )).limit(1);
  if (!attachment || (attachment.targetType && (attachment.targetType !== targetType || attachment.targetId !== targetId))) {
    throw new Error("MEDIA_ATTACHMENT_NOT_OWNED");
  }
  if (!attachment.targetType) {
    const [claimed] = await db.update(attachmentsTable).set({
      targetType,
      targetId,
      updatedAt: new Date(),
    }).where(and(
      eq(attachmentsTable.id, attachment.id),
      eq(attachmentsTable.ownerProfileId, ownerProfileId),
      isNull(attachmentsTable.targetType),
    )).returning();
    if (!claimed) throw new Error("MEDIA_ATTACHMENT_NOT_OWNED");
    return claimed;
  }
  return attachment;
}

export async function currentAttachment(
  targetType: MediaTarget,
  targetId: string,
) {
  const [attachment] = await db.select().from(attachmentsTable).where(and(
    eq(attachmentsTable.targetType, targetType),
    eq(attachmentsTable.targetId, targetId),
    eq(attachmentsTable.uploadStatus, "uploaded"),
  )).orderBy(desc(attachmentsTable.createdAt)).limit(1);
  return attachment ? serializeAttachment(attachment) : null;
}