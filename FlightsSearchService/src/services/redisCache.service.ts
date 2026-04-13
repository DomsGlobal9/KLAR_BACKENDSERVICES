import Redis from 'ioredis';
import RedisConfig from '../config/redis.config';
import { envConfig } from '../config/env';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class RedisCacheService {
  private client: Redis;
  private defaultTTL: number = envConfig.REDIS.CACHE_TTL;

  constructor() {
    this.client = RedisConfig.getInstance();
  }

  /**
   * Generate cache key with prefix
   */
  private getKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || 'flight_search:';
    return `${finalPrefix}${key}`;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      
      const serialized = JSON.stringify(value);
      await this.client.setex(cacheKey, ttl, serialized);
      
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      const data = await this.client.get(cacheKey);
      
      if (!data) return null;
      
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      const result = await this.client.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Clear all keys with pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(...keys);
      return result;
    } catch (error) {
      console.error('Redis clear pattern error:', error);
      return 0;
    }
  }

  /**
   * Set with expiration in milliseconds
   */
  async setWithExpiry<T>(
    key: string,
    value: T,
    expiryMs: number,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      const serialized = JSON.stringify(value);
      await this.client.set(cacheKey, serialized, 'PX', expiryMs);
      return true;
    } catch (error) {
      console.error('Redis set with expiry error:', error);
      return false;
    }
  }

  /**
   * Increment counter (useful for rate limiting)
   */
  async increment(key: string, options?: CacheOptions): Promise<number> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      return await this.client.incr(cacheKey);
    } catch (error) {
      console.error('Redis increment error:', error);
      return 0;
    }
  }

  /**
   * Set expiry on existing key
   */
  async expire(key: string, seconds: number, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      const result = await this.client.expire(cacheKey, seconds);
      return result === 1;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  /**
   * Get TTL of key in seconds
   */
  async getTTL(key: string, options?: CacheOptions): Promise<number> {
    try {
      const cacheKey = this.getKey(key, options?.prefix);
      return await this.client.ttl(cacheKey);
    } catch (error) {
      console.error('Redis get TTL error:', error);
      return -2;
    }
  }
}

export default new RedisCacheService();