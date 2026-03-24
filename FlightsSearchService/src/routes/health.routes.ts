import { Router } from "express";
import { healthCheck, redisHealth } from "../controllers/healthController";

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Overall system health check
 * @access  Public
 */
router.get("/", healthCheck);

/**
 * @route   GET /api/health/redis
 * @desc    Redis-specific health check
 * @access  Public
 */
router.get("/redis", redisHealth);

export default router;
