import RedisConfig from "../config/redis.config";
import { env } from "../config/env";

/**
 * Redis-backed cache for the deduplicated master result set of a hotel search
 * (see hotels.service.ts). Every method is defensive: if Redis is unavailable
 * or a call throws, get() returns null (treated as a miss) and set()/del() are
 * no-ops, so search continues on its live per-page fallback path. Redis must
 * never break search.
 */
class SearchResultCacheService {
  // Warm the connection at import time (mirrors flight-service).
  private client = RedisConfig.getInstance();

  ready(): boolean {
    return RedisConfig.isReady();
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!RedisConfig.isReady()) return null;
    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (err: any) {
      console.warn(`[SearchCache] get failed for ${key}:`, err.message);
      return null;
    }
  }

  async set(key: string, value: any, ttl = env.searchResultCacheTtl): Promise<void> {
    if (!RedisConfig.isReady()) return;
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttl);
    } catch (err: any) {
      console.warn(`[SearchCache] set failed for ${key}:`, err.message);
    }
  }

  async del(key: string): Promise<void> {
    if (!RedisConfig.isReady()) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      console.warn(`[SearchCache] del failed for ${key}:`, err.message);
    }
  }
}

export default new SearchResultCacheService();
