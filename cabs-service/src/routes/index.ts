import { Router } from "express";
import * as searchController from "../controllers/search.controller";
import * as bookingController from "../controllers/booking.controller";
import * as orderController from "../controllers/order.controller";
import * as amendmentController from "../controllers/amendment.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { getClientInvoicePdf, getAgentInvoicePdf } from "../controllers/invoice-pdf.controller";


const router = Router();

// ─── Search Routes ──────────────────────────────────────────────────────
router.post("/search/location", searchController.locationSearch);
router.post("/search/lat-long", searchController.getLatLong);
router.post("/search/quotes",   searchController.getQuotes);

// ─── Booking Routes ─────────────────────────────────────────────────────
router.post("/booking/create", authenticateJWT, bookingController.createBooking);

// ─── Order Routes ───────────────────────────────────────────────────────
router.get("/booking/details", authenticateJWT, orderController.getBookingDetails);
router.get("/booking/my-bookings", authenticateJWT, orderController.getUserBookings);
router.post("/payment/create", authenticateJWT, orderController.createPayment);

// ─── Amendment Routes ────────────────────────────────────────────────────
router.get("/amendment/charges", amendmentController.getAmendmentCharges);
router.post("/amendment/cancel", amendmentController.processCancellation);




// Confirmation and Cancellation PDF Routes
router.get("/pdf/client-invoice/:bookingId", getClientInvoicePdf);
router.get("/pdf/agent-invoice/:bookingId", getAgentInvoicePdf);


export default router;
