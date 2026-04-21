import { Router } from "express";
import {
    getCancellationCharges,
    cancelBooking,
    getCancellationStatus,
} from "../controllers/tripjackCancellation.controller";

const router = Router();

/**
 * POST /api/cancellation/charges
 */
router.post("/charges", getCancellationCharges);

/**
 * POST /api/cancellation/status
*/
router.post("/status", getCancellationStatus);

/**
 * POST /api/cancellation/cancel
 */
router.post("/", cancelBooking);

export default router;