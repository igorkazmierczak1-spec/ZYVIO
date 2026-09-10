import type { RequestHandler } from "express";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientKey(req: Parameters<RequestHandler>[0], name: string) {
  const profileId = req.res?.locals.currentUser?.id ?? "anonymous";
  return `${name}:${req.ip ?? "unknown"}:${profileId}`;
}

export function rateLimit({ name, windowMs, max }: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req, name);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too many requests. Please try again shortly.",
        retryAfter,
      });
      return;
    }

    current.count += 1;
    next();
  };
}

export function clearRateLimitBucketsForTests() {
  buckets.clear();
}