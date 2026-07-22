import Redis from "ioredis";
import { env } from "./env";

/**
 * Singleton ioredis connection for the hotel-search service, mirroring the
 * pattern used in flight-service. Search never hard-depends on Redis: callers
 * guard on isReady() and treat any failure as a cache miss, so a Redis outage
 * degrades to live per-page supplier fetching instead of breaking search.
 */
class RedisConfig {
  private static instance: Redis | null = null;
  private static isConnected = false;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis(env.redisUrl, {
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      this.instance.on("connect", () => {
        console.log("[Redis] connected");
        this.isConnected = true;
      });
      this.instance.on("ready", () => {
        console.log("[Redis] ready");
        this.isConnected = true;
      });
      this.instance.on("error", (error: Error) => {
        // Don't spam: ioredis emits 'error' on every reconnect attempt.
        console.error("[Redis] connection error:", error.message);
        this.isConnected = false;
      });
      this.instance.on("close", () => {
        this.isConnected = false;
      });
      this.instance.on("reconnecting", () => {
        this.isConnected = false;
      });
    }

    return this.instance;
  }

  static isReady(): boolean {
    return this.isConnected && this.instance?.status === "ready";
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const client = this.getInstance();
      const response = await client.ping();
      return response === "PONG";
    } catch (error) {
      return false;
    }
  }
}

export default RedisConfig;
