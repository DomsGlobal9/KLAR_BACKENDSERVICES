import RedisConfig from "../config/redis.config";

class RedisCacheService {
    private client = RedisConfig.getInstance();

    async get(key: string) {
        try {
            if (!RedisConfig.isReady()) return null;
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error: any) {
            console.warn(`[RedisCacheService] GET error for key ${key}:`, error.message);
            return null;
        }
    }

    async set(key: string, value: any, ttl = 300) {
        try {
            if (!RedisConfig.isReady()) return;
            await this.client.set(key, JSON.stringify(value), "EX", ttl);
        } catch (error: any) {
            console.warn(`[RedisCacheService] SET error for key ${key}:`, error.message);
        }
    }

    async del(key: string) {
        try {
            if (!RedisConfig.isReady()) return;
            await this.client.del(key);
        } catch (error: any) {
            console.warn(`[RedisCacheService] DEL error for key ${key}:`, error.message);
        }
    }
}

export default new RedisCacheService();