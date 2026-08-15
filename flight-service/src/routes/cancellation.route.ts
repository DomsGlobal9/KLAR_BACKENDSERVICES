import { Router } from "express";
import CancellationController from "../controllers/cancellation.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// C-3 — cancellation is irreversible, so it must be authenticated and the
// controller additionally checks that the caller owns the booking.
router.post("/charges", requireAuth, CancellationController.getCharges);
router.post("/submit", requireAuth, CancellationController.submit);
router.post("/status", requireAuth, CancellationController.status);

export default router;
