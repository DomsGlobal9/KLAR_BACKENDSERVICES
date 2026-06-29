import Redis from "ioredis";
import { StructuredError } from "./ValidationEngine";

// Configure Redis Client
// In production, use env variables: process.env.REDIS_URL
const redisClient = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

redisClient.on('connect', () => {
    console.log('✅ [Redis] Connected to server successfully!');
});

redisClient.on('error', (err) => {
    console.error('❌ [Redis] Connection Error:', err.message);
});

export class RedisLockUtil {
    /**
     * Acquire a distributed lock.
     * @param lockKey The unique key representing the resource (e.g., booking-1234)
     * @param requestId The Correlation ID trying to acquire the lock
     * @param ttlSeconds The time-to-live for the lock in seconds (default 30)
     */
    static async acquireLock(lockKey: string, requestId: string, ttlSeconds: number = 30): Promise<boolean> {
        try {
            // SET key value NX EX seconds
            // NX = Set only if Not eXists
            // EX = Expire time in seconds
            const result = await redisClient.set(lockKey, requestId, "EX", ttlSeconds, "NX");
            return result === "OK";
        } catch (error) {
            console.error(`[RedisLock] Failed to attempt lock for ${lockKey}`, error);
            return false;
        }
    }

    /**
     * Release the distributed lock securely.
     * To prevent releasing someone else's lock (if this one expired), we check the requestId.
     */
    static async releaseLock(lockKey: string, requestId: string): Promise<void> {
        try {
            // Lua script guarantees atomic check-and-delete
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
     * Helper to wrap a function execution with a lock
     */
    static async executeWithLock<T>(
        lockKey: string,
        requestId: string,
        task: () => Promise<T>,
        ttlSeconds: number = 30
    ): Promise<T> {
        const acquired = await this.acquireLock(lockKey, requestId, ttlSeconds);

        if (!acquired) {
            throw new StructuredError("DUPLICATE_REQUEST", "This booking is already being processed. Please wait.");
        }

        try {
            return await task();
        } finally {
            await this.releaseLock(lockKey, requestId);
        }
    }
}
