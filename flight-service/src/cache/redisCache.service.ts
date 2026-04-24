import RedisConfig from "../config/redis.config";

class RedisCacheService {
    private client = RedisConfig.getInstance();

    async get(key: string) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async set(key: string, value: any, ttl = 300) {
        await this.client.set(key, JSON.stringify(value), "EX", ttl);
    }

    async del(key: string) {
        await this.client.del(key);
    }
}

export default new RedisCacheService();