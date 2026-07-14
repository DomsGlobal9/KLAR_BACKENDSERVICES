import Redis from "ioredis";
import { StructuredError } from "./StructuredError";

/**
 * Distributed booking lock.
 *
 * IMPORTANT — degraded mode: unlike hotel-booking-service (which always runs
 * with Redis and fails CLOSED), the cabs deployment does not necessarily have a
 * Redis instance. So this util is *best-effort*:
 *
 *   • REDIS_URL set  -> real distributed lock. Connection errors fail CLOSED
 *     (reject rather than risk a double supplier charge), unless LOCK_FAIL_OPEN=true.
 *   • REDIS_URL unset -> the distributed lock is skipped entirely and we rely on
 *     the UNIQUE index on `idempotencyKey` in CabBooking as the hard backstop
 *     against duplicate bookings.
 *
 * The idempotency index is the real guarantee; the Redis lock only narrows the
 * race window and gives a friendlier "already processing" response.
 */
const redisUrl = process.env.REDIS_URL;
let redisClient: Redis | null = null;

if (redisUrl) {
  redisClient = new Redis(redisUrl);

  redisClient.on("connect", () => {
    console.log("✅ [Redis] Cabs lock store connected.");
  });

  // Rate-limited error logging so a Redis outage is visible without flooding logs.
  let lastRedisErrorLog = 0;
  redisClient.on("error", (err: any) => {
    const now = Date.now();
    if (now - lastRedisErrorLog > 30_000) {
      lastRedisErrorLog = now;
      console.error(`[Redis] connection error: ${err?.message || err}`);
    }
  });
} else {
  console.warn(
    "⚠️  [Redis] REDIS_URL not set — distributed booking lock disabled. " +
      "Duplicate protection relies on the idempotencyKey unique index only.",
  );
}

export class RedisLockUtil {
  /** Whether a real lock store is available. */
  static get isEnabled(): boolean {
    return redisClient !== null;
  }

  /**
   * Acquire a distributed lock. Returns true when the caller now holds it.
   * When Redis is not configured, always returns true (no-op lock).
   */
  static async acquireLock(
    lockKey: string,
    requestId: string,
    ttlSeconds: number = 30,
  ): Promise<boolean> {
    if (!redisClient) return true; // degraded mode: idempotency index is the backstop

    try {
      // SET key value NX EX seconds -> only sets if key does not already exist.
      const result = await redisClient.set(lockKey, requestId, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (error: any) {
      console.error(`[RedisLock] Failed to attempt lock for ${lockKey}`, error?.message);
      // Fail CLOSED by default: without the lock we cannot rule out a concurrent
      // retry double-charging the wallet/supplier. Set LOCK_FAIL_OPEN=true to
      // knowingly accept that risk.
      if (process.env.LOCK_FAIL_OPEN === "true") return true;
      throw new StructuredError(
        "LOCK_UNAVAILABLE",
        "Booking service is momentarily busy. Please try again in a few seconds.",
      );
    }
  }

  /**
   * Release the lock, but only if we still own it (atomic check-and-delete).
   */
  static async releaseLock(lockKey: string, requestId: string): Promise<void> {
    if (!redisClient) return;
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redisClient.eval(script, 1, lockKey, requestId);
    } catch (error) {
      console.error(`[RedisLock] Failed to release lock for ${lockKey}`, error);
    }
  }

  /**
   * Run `task` while holding the lock. Rejects with DUPLICATE_REQUEST if another
   * request already holds it.
   */
  static async executeWithLock<T>(
    lockKey: string,
    requestId: string,
    task: () => Promise<T>,
    ttlSeconds: number = 30,
  ): Promise<T> {
    const acquired = await this.acquireLock(lockKey, requestId, ttlSeconds);
    if (!acquired) {
      throw new StructuredError(
        "DUPLICATE_REQUEST",
        "This booking is already being processed. Please wait.",
      );
    }
    try {
      return await task();
    } finally {
      await this.releaseLock(lockKey, requestId);
    }
  }
}
