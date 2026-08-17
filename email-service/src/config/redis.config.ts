import Redis, { RedisOptions } from 'ioredis';
import { envConfig } from './env.config';

export const redisConnectionOptions: RedisOptions = {
    host: envConfig.REDIS_HOST,
    port: envConfig.REDIS_PORT,
    password: envConfig.REDIS_PASSWORD,
    db: envConfig.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        return Math.min(times * 500, 3000);
    },
};

let redisClient: Redis | null = null;
let isConnecting = false;

export const getRedisClient = (): Redis => {
    if (!redisClient && !isConnecting) {
        isConnecting = true;
        redisClient = new Redis(redisConnectionOptions);

        redisClient.on('connect', () => {
            console.log(`✅ Redis connected successfully at ${envConfig.REDIS_HOST}:${envConfig.REDIS_PORT}`);
            isConnecting = false;
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis is ready to accept commands');
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message);
            if (err.message.includes('ECONNREFUSED')) {
                console.error('❌ Redis connection refused. Please check if Redis server is running.');
            }
            isConnecting = false;
        });

        redisClient.on('close', () => {
            console.log('⚠️ Redis connection closed');
        });

        redisClient.on('reconnecting', (delay: any) => {
            console.log(`🔄 Redis reconnecting in ${delay}ms...`);
        });

        redisClient.on('end', () => {
            console.log('⚠️ Redis connection ended');
            redisClient = null;
            isConnecting = false;
        });
    }
    return redisClient as Redis;
};

export const closeRedisClient = async (): Promise<void> => {
    if (redisClient) {
        try {
            redisClient.disconnect();
            console.log('✅ Redis connection disconnected.');
        } catch (error) {
            console.error('❌ Error disconnecting Redis:', error);
        } finally {
            redisClient = null;
            isConnecting = false;
        }
    }
};

/**
 * Optional Testing Function 
 * Test connection function
 * @returns 
 */
export const testRedisConnection = async (): Promise<boolean> => {
    try {
        const client = getRedisClient();
        await client.ping();
        console.log('✅ Redis ping successful');
        return true;
    } catch (error) {
        console.error('❌ Redis ping failed:', error);
        return false;
    }
};