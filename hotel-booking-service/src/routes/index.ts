import { Router } from "express";
import { commitController } from "../controllers/commit.controller";
import { cancelController } from "../controllers/cancel.controller";
import { precheckController } from "../controllers/precheck.controller";
import { specialRequestsController } from "../controllers/special-requests.controller";
import bookingHistoryController from "../controllers/booking-history.controller";
import bookingsController from "../controllers/bookings.controller";
import { authenticate } from "../../../shared/auth/auth.middleware";
import authRoutes from "../../../shared/auth/auth.routes";

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ status: "UP", service: "hotel-booking-service" });
});

// Authentication routes (public)
router.use("/auth", authRoutes);

// Booking routes (protected - require authentication)
router.post("/precheck", authenticate, precheckController);
router.post("/commit", authenticate, commitController);
router.post("/cancel", authenticate, cancelController);
router.post("/bookings", authenticate, bookingsController.createBooking.bind(bookingsController));

// Booking history routes (protected)
router.get("/bookings/stats", authenticate, bookingHistoryController.getBookingStats.bind(bookingHistoryController));
router.get("/bookings/confirmation/:number", authenticate, bookingHistoryController.getBookingByConfirmation.bind(bookingHistoryController));
router.get("/bookings/:id", authenticate, bookingHistoryController.getBookingById.bind(bookingHistoryController));
router.get("/bookings", authenticate, bookingHistoryController.getBookings.bind(bookingHistoryController));

// Special requests (public - or protect if needed)
router.get("/special-requests", specialRequestsController);

export default router;

