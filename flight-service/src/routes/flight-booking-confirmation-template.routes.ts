import { Router } from "express";
import BookingController from "../controllers/flight-confirmation-template.controller"

const router = Router();

// Add this GET route for the PDF
router.get("/confirm-template/:bookingId", BookingController.getConfirmationPdf);

export default router;