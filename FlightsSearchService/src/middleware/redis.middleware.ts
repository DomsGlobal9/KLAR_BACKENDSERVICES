import { Request, Response, NextFunction } from 'express';
import RedisConfig from '../config/redis.config';

export const monitorRedisHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isHealthy = await RedisConfig.healthCheck();
    
    if (!isHealthy) {
      console.warn('⚠️ Redis is unhealthy, falling back to direct API calls');
      // Fallback behavior is handled inside services/controllers using health checks
    }
    
    next();
  } catch (error) {
    console.error('Redis monitor error:', error);
    next();
  }
};

// Middleware to track cache hit/miss rates
export const trackCacheMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const cacheKey = `cache_metrics:${req.path}`;
  
  // Add response interceptor
  const originalJson = res.json;
  res.json = function(data: any) {
    const responseTime = Date.now() - startTime;
    
    // Track cache hit/miss - assuming our flight controller returns sessionId for cached results
    const isCached = data?.data?.sessionId ? true : false;
    const metric = {
      timestamp: new Date().toISOString(),
      path: req.path,
      isCached,
      responseTime,
      statusCode: res.statusCode
    };
    
    // Store metrics in Redis if available
    try {
      const redis = RedisConfig.getInstance();
      if (redis) {
          redis.lpush('cache_metrics', JSON.stringify(metric));
          redis.ltrim('cache_metrics', 0, 999);
      }
    } catch (metricError) {
      console.error('Failed to store cache metric:', metricError);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};
