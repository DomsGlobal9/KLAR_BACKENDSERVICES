import Redis from 'ioredis';
import { envConfig } from './env';

class RedisConfig {
  private static instance: Redis;
  private static isConnected = false;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis({
        host: envConfig.REDIS.HOST,
        port: envConfig.REDIS.PORT,
        password: envConfig.REDIS.PASSWORD,
        db: envConfig.REDIS.DB,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      this.instance.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.instance.on('error', (error) => {
        console.error('❌ Redis connection error:', error);
        this.isConnected = false;
      });

      this.instance.on('close', () => {
        console.log('⚠️ Redis connection closed');
        this.isConnected = false;
      });
    }
    return this.instance;
  }

  static isReady(): boolean {
    return this.isConnected && this.getInstance().status === 'ready';
  }

  static async healthCheck(): Promise<boolean> {
    try {
      await this.getInstance().ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

export default RedisConfig;