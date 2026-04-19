import { Router } from "express";
import BookingController from "../controllers/booking.controller";

const router = Router();


router.post("/instant", BookingController.bookFlight);

router.post("/confirm-hold", BookingController.confirmHoldBooking);

router.post("/fare-validate", BookingController.confirmFareBeforeTicketing);

export default router;