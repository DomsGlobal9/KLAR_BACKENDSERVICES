import { Router } from "express";
import { precheckController } from "../controllers/precheck.controller";
import { commitController } from "../controllers/commit.controller";
import { cancelController } from "../controllers/cancel.controller";
import { specialRequestsController } from "../controllers/special-requests.controller";

const router = Router();

router.get("/", (_req, res) => {
    res.json({
        service: "hotel-booking-service",
        endpoints: {
            health: "GET /health",
            precheck: "POST /precheck",
            commit: "POST /commit",
            cancel: "POST /cancel",
            specialRequests: "GET /special-requests"
        }
    });
});

router.get("/health", (_req, res) => {
    res.json({ status: "UP", service: "hotel-booking-service" });
});

// RateGain booking flow — no auth required
router.post("/precheck", precheckController);
router.post("/commit", commitController);
router.post("/cancel", cancelController);
router.get("/special-requests", specialRequestsController);

export default router;
