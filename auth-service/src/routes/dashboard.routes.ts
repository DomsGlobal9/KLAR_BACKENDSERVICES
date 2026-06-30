import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";

const router = Router();

router.get("/stats", authenticateJWT, DashboardController.getStats);

export default router;