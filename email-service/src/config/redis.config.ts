import Redis from "ioredis";
import { envConfig } from "./env.config";

class RedisConfig {
    private static instance: Redis | null = null;
    private static isConnected = false;

    static getInstance(): Redis {
        if (!this.instance) {
            this.instance = new Redis(envConfig.REDIS_URL, {
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,
            });

            this.instance.on("connect", () => {
                console.log("Redis connected successfully");
                this.isConnected = true;
            });

            this.instance.on("ready", () => {
                console.log("Redis is ready to use");
                this.isConnected = true;
            });

            this.instance.on("error", (error: Error) => {
                console.error("Redis connection error:", error);
                this.isConnected = false;
            });

            this.instance.on("close", () => {
                console.log("Redis connection closed");
                this.isConnected = false;
            });

            this.instance.on("reconnecting", () => {
                console.log("Redis reconnecting...");
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
            console.error("Redis health check failed:", error);
            return false;
        }
    }
}

export default RedisConfig;