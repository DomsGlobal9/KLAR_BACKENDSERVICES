import { Router } from "express";
import * as searchController from "../controllers/search.controller";
import * as bookingController from "../controllers/booking.controller";
import * as orderController from "../controllers/order.controller";
import * as amendmentController from "../controllers/amendment.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { optionalAuthenticateJWT } from "../middlewares/optionalAuth.middleware";
import { getClientInvoicePdf, getAgentInvoicePdf } from "../controllers/invoice-pdf.controller";


const router = Router();

// ─── Search Routes ──────────────────────────────────────────────────────
router.post("/search/location", searchController.locationSearch);
router.post("/search/lat-long", searchController.getLatLong);
router.post("/search/quotes", optionalAuthenticateJWT, searchController.getQuotes);

// ─── Booking Routes ─────────────────────────────────────────────────────
// Optional auth: B2B agents send a token (-> B2B wallet), B2C/guests don't
// (-> Razorpay). The controller resolves the channel.
router.post("/booking/create", optionalAuthenticateJWT, bookingController.createBooking);

// ─── Order Routes ───────────────────────────────────────────────────────
router.get("/booking/details", optionalAuthenticateJWT, orderController.getBookingDetails);
router.get("/booking/my-bookings", authenticateJWT, orderController.getUserBookings);
router.get("/booking/check/:email", orderController.checkEmailBookings);
router.post("/payment/create", authenticateJWT, orderController.createPayment);

// ─── Amendment Routes ────────────────────────────────────────────────────
// Optional auth attaches req.user when a token is present; the controllers then
// enforce booking ownership (a bare bookingId is never enough to cancel/read a
// ride — see ownership.util). A B2B agent's token also lets us refund their
// Klar wallet; B2C/guest refunds go back to Razorpay.
router.get("/amendment/charges", optionalAuthenticateJWT, amendmentController.getAmendmentCharges);
router.post("/amendment/cancel", optionalAuthenticateJWT, amendmentController.processCancellation);




// Confirmation and Cancellation PDF Routes
router.get("/pdf/client-invoice/:bookingId", getClientInvoicePdf);
router.get("/pdf/agent-invoice/:bookingId", getAgentInvoicePdf);


export default router;
