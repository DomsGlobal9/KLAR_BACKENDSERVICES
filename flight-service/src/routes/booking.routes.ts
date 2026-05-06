import { Router } from "express";
import BookingController from "../controllers/booking.controller";

const router = Router();

router.post("/instant", BookingController.instantBook);
router.post("/hold", BookingController.holdBook);
router.post("/validate", BookingController.validateFare);
router.post("/confirm", BookingController.confirm);

export default router;