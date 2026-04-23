import { Router } from "express";
import BookingLocalController from "../controllers/bookingLocal.controller";

const router = Router();

router.post("/init", BookingLocalController.createLocalBooking);
router.put("/update", BookingLocalController.updateBookingDetails);

export default router;