import { Request, Response } from "express";
import { getCacheStats, isConnected } from "../services/redisService";
import mongoose from "mongoose";

/**
 * Health check endpoint
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
        // Check MongoDB
        const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

        // Check Redis
        const redisConnected = isConnected();
        const redisStats = await getCacheStats();

        const health = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            services: {
                api: {
                    status: "up",
                    uptime: process.uptime(),
                },
                mongodb: {
                    status: mongoStatus,
                    database: mongoose.connection.db?.databaseName || "unknown",
                },
                redis: {
                    status: redisConnected ? "connected" : "disconnected",
                    totalKeys: redisStats.totalKeys,
                    memoryUsed: redisStats.memoryUsed,
                },
            },
            environment: process.env.NODE_ENV || "development",
        };

        // Overall health status
        if (mongoStatus !== "connected") {
            health.status = "degraded";
        }

        res.status(200).json(health);
    } catch (error: any) {
        res.status(500).json({
            status: "unhealthy",
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
};

/**
 * Redis-specific health check
 */
export const redisHealth = async (req: Request, res: Response): Promise<void> => {
    try {
        const connected = isConnected();
        const stats = await getCacheStats();

        res.status(connected ? 200 : 503).json({
            connected,
            stats,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
};
