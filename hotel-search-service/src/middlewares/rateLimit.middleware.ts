import { Request, Response, NextFunction } from "express";

/**
 * Lightweight in-memory sliding-window rate limiter — no external deps / Redis.
 *
 * The hotel search endpoint is public and unauthenticated, and every call fans
 * out to paid supplier APIs (TripJack + RateGain). Without a limit, a client
 * loop or a scraper can exhaust supplier quotas / rack up cost. This is a
 * per-process guard (good enough per pm2 instance); for a global limit across
 * instances, back it with Redis.
 */
interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();
const WINDOW_MS = Number(process.env.SEARCH_RATE_WINDOW_MS || 60_000);
const MAX = Number(process.env.SEARCH_RATE_MAX || 60);

// Evict expired buckets so the map can't grow unbounded.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}, WINDOW_MS);
// Don't keep the event loop alive just for cleanup.
(cleanup as any).unref?.();

export function searchRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();
  const hit = buckets.get(ip);

  if (!hit || hit.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  hit.count += 1;
  if (hit.count > MAX) {
    const retryAfter = Math.ceil((hit.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      status: false,
      statusCode: 429,
      description: "Too many requests. Please slow down and try again shortly.",
      body: [],
    });
  }

  next();
}
