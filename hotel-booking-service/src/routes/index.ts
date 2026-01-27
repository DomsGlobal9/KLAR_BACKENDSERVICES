import { Router } from "express";
import { commitController } from "../controllers/commit.controller";
import { cancelController } from "../controllers/cancel.controller";
import { precheckController } from "../controllers/precheck.controller";
import { specialRequestsController } from "../controllers/special-requests.controller";

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ status: "UP", service: "hotel-booking-service" });
});

router.post("/precheck", precheckController);
router.post("/commit", commitController);
router.post("/cancel", cancelController);
router.get("/special-requests", specialRequestsController);

export default router;

