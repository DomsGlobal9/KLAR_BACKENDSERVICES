import { Router } from "express";
import BookingLocalController from "../controllers/bookingLocal.controller";

const router = Router();

router.post("/init", BookingLocalController.createLocalBooking);

export default router;