import { clerkClient, getAuth } from "@clerk/express";
import { appSettingsTable, db, profilesTable, userActivityEventsTable, type Profile } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, RequestHandler, Response } from "express";

function usernameFromEmail(email: string, userId: string): string {
  const base =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 24) || "vybe-user";
  return `${base}-${userId.slice(-6).toLowerCase()}`;
}

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function activityProgress(profile: Profile, now: Date) {
  const daysSinceLastActivity = Math.floor((utcDay(now) - utcDay(profile.lastActiveAt)) / 86_400_000);
  const nextStreak = daysSinceLastActivity === 1
    ? profile.streak + 1
    : daysSinceLastActivity > 1
      ? 1
      : profile.streak;
  const addedDay = daysSinceLastActivity > 0 ? 1 : 0;
  return {
    streak: nextStreak,
    bestStreak: Math.max(profile.bestStreak, nextStreak),
    activeDays: profile.activeDays + addedDay,
  };
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

  if (existing) {
    if (existing.status === "BLOCKED" || existing.status === "DELETED") {
      throw new Error(`ACCOUNT_${existing.status}`);
    }
    if (Date.now() - existing.lastActiveAt.getTime() >= 5 * 60 * 1000) {
      const active = await db.transaction(async (tx) => {
        const now = new Date();
        const progress = activityProgress(existing, now);
        const [row] = await tx.update(profilesTable).set({
          lastActiveAt: now,
          ...progress,
          updatedAt: now,
        }).where(eq(profilesTable.id, userId)).returning();
        await tx.insert(userActivityEventsTable).values({ id: `activity-${crypto.randomUUID()}`, profileId: userId });
        return row;
      });
      return active ?? existing;
    }
    return existing;
  }

  const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global"));
  if (settings && !settings.registrationsEnabled) throw new Error("REGISTRATIONS_DISABLED");
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

  await db.transaction(async (tx) => {
    await tx.insert(profilesTable).values({
      id: userId,
      email: primaryEmail.toLowerCase(),
      username: usernameFromEmail(primaryEmail, userId),
      displayName,
      country: "PL",
      avatarUrl: clerkUser.imageUrl ?? "",
      role: "USER",
      authProvider: "clerk",
      streak: 1,
      bestStreak: 1,
      activeDays: 1,
    }).onConflictDoNothing();
    await tx.insert(userActivityEventsTable).values({ id: `activity-${crypto.randomUUID()}`, profileId: userId });
  });

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
    const user = await getOrCreateCurrentUser(req);
    const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global"));
    if (settings?.maintenanceMode && user.role !== "ADMIN") {
      res.status(503).json({ error: "VYBE is temporarily in maintenance mode" });
      return;
    }
    res.locals.currentUser = user;
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
    if (error instanceof Error && (error.message === "ACCOUNT_BLOCKED" || error.message === "ACCOUNT_DELETED")) {
      res.status(403).json({ error: "Account is not active" });
      return;
    }
    if (error instanceof Error && error.message === "REGISTRATIONS_DISABLED") {
      res.status(503).json({ error: "Registrations are temporarily disabled" });
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