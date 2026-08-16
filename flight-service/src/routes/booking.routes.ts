import { Router } from "express";
import BookingController from "../controllers/booking.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// C-3 — every one of these either issues a ticket, spends money or returns
// traveller PII. None of them were authenticated before.
router.post("/instant", requireAuth, BookingController.instantBook);
router.post("/hold", requireAuth, BookingController.holdBook);
router.post("/validate", requireAuth, BookingController.validateFare);
router.post("/confirm", requireAuth, BookingController.confirm);
router.get("/details/:bookingId", requireAuth, BookingController.getBookingDetails);

export default router;
