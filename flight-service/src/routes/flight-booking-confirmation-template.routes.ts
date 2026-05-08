// import { Router } from "express";
// import { getFlightConfirmationPdf } from "../controllers/flight-confirmation-template.controller";

// const router = Router();

// // GET /api/flight/confirmation-template/TJS102402200197
// router.get("/confirmation-template/:id", getFlightConfirmationPdf);

// export default router;



















import { Router } from "express";
import BookingController from "../controllers/booking.controller";

const router = Router();

// Add this GET route for the PDF
router.get("/confirmation-template/:bookingId", BookingController.getConfirmationPdf);

export default router;