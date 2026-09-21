import { eq, lt, sql } from "drizzle-orm";
import { db, rateLimitBucketsTable } from "@workspace/db";
import type { Request, RequestHandler } from "express";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  ipMax?: number;
};

type LimitScope = {
  key: string;
  max: number;
};

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60_000;

export function clientIp(req: Request) {
  return req.ip?.trim() || "unknown";
}

function scopesFor(req: Request, options: RateLimitOptions): LimitScope[] {
  const profileId = req.res?.locals.currentUser?.id;
  const scopes: LimitScope[] = [];
  if (profileId) {
    scopes.push({
      key: `${options.name}:profile:${profileId}`,
      max: options.max,
    });
  }
  if (options.ipMax !== undefined) {
    scopes.push({
      key: `${options.name}:ip:${clientIp(req)}`,
      max: options.ipMax,
    });
  }
  return scopes;
}

async function consumeScopes(scopes: LimitScope[], windowMs: number) {
  if (!scopes.length) return { allowed: true, retryAfter: 0 };
  const uniqueScopes = [...new Map(scopes.map((scope) => [scope.key, scope])).values()];

  return db.transaction(async (tx) => {
    // Lock all keys in a stable order so concurrent requests cannot overspend
    // a bucket or deadlock while checking both profile and IP limits.
    for (const scope of [...uniqueScopes].sort((left, right) => left.key.localeCompare(right.key))) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${scope.key}))`,
      );
    }

    const now = new Date();
    const rows = await Promise.all(
      uniqueScopes.map(async (scope) => {
        const [row] = await tx
          .select()
          .from(rateLimitBucketsTable)
          .where(eq(rateLimitBucketsTable.key, scope.key));
        return { scope, row };
      }),
    );
    const blocked = rows
      .filter(({ scope, row }) => row && row.resetAt > now && row.count >= scope.max)
      .sort((left, right) => (left.row?.resetAt.getTime() ?? 0) - (right.row?.resetAt.getTime() ?? 0))[0];
    if (blocked?.row) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((blocked.row.resetAt.getTime() - now.getTime()) / 1000)),
      };
    }

    const resetAt = new Date(now.getTime() + windowMs);
    for (const { scope, row } of rows) {
      if (!row || row.resetAt <= now) {
        await tx
          .insert(rateLimitBucketsTable)
          .values({ key: scope.key, count: 1, resetAt })
          .onConflictDoUpdate({
            target: rateLimitBucketsTable.key,
            set: { count: 1, resetAt },
          });
      } else {
        await tx
          .update(rateLimitBucketsTable)
          .set({ count: row.count + 1 })
          .where(eq(rateLimitBucketsTable.key, scope.key));
      }
    }
    return { allowed: true, retryAfter: 0 };
  });
}

async function cleanupExpiredBuckets() {
  const cutoff = new Date(Date.now() - CLEANUP_INTERVAL_MS);
  await db
    .delete(rateLimitBucketsTable)
    .where(lt(rateLimitBucketsTable.resetAt, cutoff));
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { name, windowMs } = options;
  return async (req, res, next) => {
    try {
      const now = Date.now();
      if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        lastCleanupAt = now;
        void cleanupExpiredBuckets().catch((error) => {
          req.log?.warn?.({ err: error }, "Rate-limit bucket cleanup failed");
        });
      }
      const result = await consumeScopes(scopesFor(req, options), windowMs);
      if (!result.allowed) {
        res.setHeader("Retry-After", result.retryAfter);
        res.status(429).json({
          error: "Too many requests. Please try again shortly.",
          retryAfter: result.retryAfter,
        });
        return;
      }
      next();
    } catch (error) {
      req.log?.error?.({ err: error, limiter: name }, "Rate-limit check failed");
      // Never fail open when the shared limiter cannot be reached.
      res.status(503).json({ error: "Request protection is temporarily unavailable" });
    }
  };
}

export async function clearRateLimitBucketsForTests() {
  await db.delete(rateLimitBucketsTable);
  lastCleanupAt = 0;
}