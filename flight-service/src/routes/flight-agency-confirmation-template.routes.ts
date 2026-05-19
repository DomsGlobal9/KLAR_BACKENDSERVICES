import { Router } from "express";
import FlightAgencyBookingController from "../controllers/flight-agency-confirmation-template.controller";

const router = Router();

// GET route for the Agency PDF confirmation
router.get("/confirm-agency-template/:bookingId", FlightAgencyBookingController.getAgencyConfirmationPdf);

export default router;