import { Router } from "express";
import BookingLocalController from "../controllers/bookingLocal.controller";

const router = Router();

router.post("/init", BookingLocalController.createLocalBooking);
router.put("/update", BookingLocalController.updateBookingDetails);
router.put("/update-and-book", BookingLocalController.updateAndBook);
router.get("/my-bookings", BookingLocalController.getUserBookings);
router.get("/details/:bookingId", BookingLocalController.getBookingById);
router.get('/check-email', BookingLocalController.checkBookingByEmail);

// ===================================
// ===================================
// ==========TESTING==================
// ===================================
// ===================================

router.post('/test', BookingLocalController.testProcessAftermath);

export default router;