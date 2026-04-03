// bff/src/routes/dashboard.routes.ts
import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";

const router = Router();

router.get("/stats", DashboardController.getStats);

export default router;