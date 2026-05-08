import { Router } from "express";
import { getFlightConfirmationPdf } from "../controllers/flight-booking.controller";

const router = Router();

// GET /api/flight/confirmation-template/TJS102402200197
router.get("/confirmation-template/:id", getFlightConfirmationPdf);

export default router;