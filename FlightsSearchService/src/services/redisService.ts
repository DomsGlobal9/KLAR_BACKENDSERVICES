import { createClient } from "redis";
import { envConfig } from "../config/env";

/**
 * Redis client instance
 */
export const client = createClient({ url: envConfig.REDIS.URL });

/**
 * Track Redis connection status
 */
let isRedisConnected = false;

/**
 * Error handler
 */
client.on("error", (err) => {
  console.error("❌ Redis Error:", err.message);
  isRedisConnected = false;
});

/**
 * Connection handler
 */
client.on("connect", () => {
  console.log("🔄 Redis connecting...");
});

/**
 * Ready handler
 */
client.on("ready", () => {
  console.log("✅ Redis Connected and Ready");
  isRedisConnected = true;
});

/**
 * Initialize Redis connection
 */
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.log("⚠️ Redis not available, continuing without cache");
    isRedisConnected = false;
  }
})();

/**
 * Get value from cache
 */
export const getCache = async (key: string): Promise<string | null> => {
  try {
    if (!isRedisConnected) return null;
    return await client.get(key);
  } catch (error) {
    console.error("Redis GET error:", error);
    return null;
  }
};

/**
 * Set value in cache with TTL
 */
export const setCache = async (
  key: string,
  value: string,
  ttl: number
): Promise<boolean> => {
  try {
    if (!isRedisConnected) return false;
    await client.setEx(key, ttl, value);
    return true;
  } catch (error) {
    console.error("Redis SET error:", error);
    return false;
  }
};

/**
 * Delete a key from cache
 */
export const deleteCache = async (key: string): Promise<boolean> => {
  try {
    if (!isRedisConnected) return false;
    await client.del(key);
    return true;
  } catch (error) {
    console.error("Redis DEL error:", error);
    return false;
  }
};

/**
 * Delete multiple keys matching a pattern
 */
export const deleteCachePattern = async (pattern: string): Promise<number> => {
  try {
    if (!isRedisConnected) return 0;

    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;

    await client.del(keys);
    return keys.length;
  } catch (error) {
    console.error("Redis DELETE PATTERN error:", error);
    return 0;
  }
};

/**
 * Check if a key exists
 */
export const existsCache = async (key: string): Promise<boolean> => {
  try {
    if (!isRedisConnected) return false;
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error("Redis EXISTS error:", error);
    return false;
  }
};

/**
 * Get remaining TTL for a key
 */
export const getTTL = async (key: string): Promise<number> => {
  try {
    if (!isRedisConnected) return -1;
    return await client.ttl(key);
  } catch (error) {
    console.error("Redis TTL error:", error);
    return -1;
  }
};

/**
 * Increment a counter
 */
export const incrementCounter = async (key: string): Promise<number> => {
  try {
    if (!isRedisConnected) return 0;
    return await client.incr(key);
  } catch (error) {
    console.error("Redis INCR error:", error);
    return 0;
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  connected: boolean;
  totalKeys: number;
  memoryUsed?: string;
}> => {
  try {
    if (!isRedisConnected) {
      return { connected: false, totalKeys: 0 };
    }

    const dbSize = await client.dbSize();
    const info = await client.info("memory");

    // Parse memory usage from info string
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1] : undefined;

    return {
      connected: true,
      totalKeys: dbSize,
      memoryUsed,
    };
  } catch (error) {
    console.error("Redis STATS error:", error);
    return { connected: false, totalKeys: 0 };
  }
};

/**
 * Flush all cache (use with caution!)
 */
export const flushCache = async (): Promise<boolean> => {
  try {
    if (!isRedisConnected) return false;
    await client.flushDb();
    console.log("🗑️ Redis cache flushed");
    return true;
  } catch (error) {
    console.error("Redis FLUSH error:", error);
    return false;
  }
};

/**
 * Check if Redis is connected
 */
export const isConnected = (): boolean => {
  return isRedisConnected;
};

/**
 * Graceful shutdown
 */
export const disconnectRedis = async (): Promise<void> => {
  try {
    if (isRedisConnected) {
      await client.quit();
      console.log("👋 Redis disconnected gracefully");
    }
  } catch (error) {
    console.error("Redis disconnect error:", error);
  }
};

/**
 * Cache wrapper for async functions
 */
export const cacheWrapper = async <T>(
  key: string,
  ttl: number,
  fetchFunction: () => Promise<T>
): Promise<T> => {
  // Try to get from cache
  const cached = await getCache(key);
  if (cached) {
    console.log(`⚡ Cache HIT: ${key}`);
    return JSON.parse(cached) as T;
  }

  // Cache miss - fetch data
  console.log(`💾 Cache MISS: ${key}`);
  const data = await fetchFunction();

  // Store in cache
  await setCache(key, JSON.stringify(data), ttl);

  return data;
};
