import { Router } from "express";
import * as searchController from "../controllers/search.controller";
import * as bookingController from "../controllers/booking.controller";
import * as orderController from "../controllers/order.controller";
import * as amendmentController from "../controllers/amendment.controller";

const router = Router();

// ─── Search Routes ──────────────────────────────────────────────────────
router.post("/search/location", searchController.locationSearch);
router.post("/search/lat-long", searchController.getLatLong);
router.post("/search/quotes",   searchController.getQuotes);

// ─── Booking Routes ─────────────────────────────────────────────────────
router.post("/booking/create",   bookingController.createBooking);
router.post("/booking/embedded", bookingController.createEmbeddedBooking);

// ─── Order Routes ───────────────────────────────────────────────────────
router.get("/booking/details",   orderController.getBookingDetails);
router.post("/payment/create",   orderController.createPayment);

// ─── Amendment Routes ────────────────────────────────────────────────────
router.get("/amendment/charges", amendmentController.getAmendmentCharges);
router.post("/amendment/cancel", amendmentController.processCancellation);

export default router;
