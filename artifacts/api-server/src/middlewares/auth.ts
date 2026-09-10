import { clerkClient, getAuth } from "@clerk/express";
import { db, profilesTable, type Profile } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, RequestHandler, Response } from "express";

function configuredAdminUserId(): string | undefined {
  const value = process.env.VYBE_ADMIN_USER_ID?.trim();
  return value || undefined;
}

function usernameFromEmail(email: string, userId: string): string {
  const base =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 24) || "vybe-user";
  return `${base}-${userId.slice(-6).toLowerCase()}`;
}

export async function getOrCreateCurrentUser(req: Request): Promise<Profile> {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId));

  const shouldBeAdmin = configuredAdminUserId() === userId;
  if (existing) {
    if (shouldBeAdmin && existing.role !== "ADMIN") {
      const [promoted] = await db
        .update(profilesTable)
        .set({ role: "ADMIN", updatedAt: new Date() })
        .where(eq(profilesTable.id, userId))
        .returning();
      return promoted ?? existing;
    }
    return existing;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (item) => item.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) {
    throw new Error("AUTH_EMAIL_REQUIRED");
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    primaryEmail.split("@")[0] ||
    "VYBE Creator";

  await db
    .insert(profilesTable)
    .values({
      id: userId,
      email: primaryEmail.toLowerCase(),
      username: usernameFromEmail(primaryEmail, userId),
      displayName,
      country: "PL",
      avatarUrl: clerkUser.imageUrl ?? "",
      role: shouldBeAdmin ? "ADMIN" : "USER",
      authProvider: "clerk",
    })
    .onConflictDoNothing();

  const [created] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId));
  if (!created) {
    throw new Error("LOCAL_USER_PROVISION_FAILED");
  }
  return created;
}

export const requireAuthenticatedUser: RequestHandler = async (req, res, next) => {
  try {
    res.locals.currentUser = await getOrCreateCurrentUser(req);
    next();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (error instanceof Error && error.message === "AUTH_EMAIL_REQUIRED") {
      res.status(422).json({ error: "A verified email address is required" });
      return;
    }
    next(error);
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const currentUser = res.locals.currentUser as Profile | undefined;
  if (!currentUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (currentUser.role !== "ADMIN") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
};

export function currentUserFrom(res: Response): Profile {
  const currentUser = res.locals.currentUser as Profile | undefined;
  if (!currentUser) {
    throw new Error("Authenticated user missing from response locals");
  }
  return currentUser;
}