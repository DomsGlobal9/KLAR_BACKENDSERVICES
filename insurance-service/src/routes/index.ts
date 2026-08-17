import { Router } from "express";
import mongoose from "mongoose";
import { authenticateJWT } from "../middlewares/auth.middleware";

import { searchController }            from "../controllers/search.controller";
import { reviewController }            from "../controllers/review.controller";
import { bookController }              from "../controllers/book.controller";
import { bookingDetailsController, bookingDetailsFromDbController } from "../controllers/bookingDetails.controller";
import { listController }              from "../controllers/list.controller";
import { raiseAmendmentController, cancelController } from "../controllers/amendment.controller";
import { countryController }           from "../controllers/country.controller";
import { checkEmailController, bookingHistoryController } from "../controllers/bookingHistory.controller";

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/", (_req, res) => {
    res.json({
        service: "insurance-service",
        version: "1.0.0",
        endpoints: {
            health:         "GET  /health",
            countries:      "GET  /countries",
            countrySearch:  "GET  /countries/search",
            search:         "POST /search",
            review:         "POST /review",
            book:           "POST /book",
            bookingDetails: "POST /booking-details",
            bookings:       "GET  /bookings",
            checkEmail:     "GET  /bookings/check-email",
            bookingHistory: "GET  /bookings/history",
            bookingById:    "GET  /bookings/:id",
            raiseAmend:     "POST /amendment/raise",
            cancelAmend:    "POST /amendment/cancel",
        },
    });
});

router.get("/health", (_req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";
    res.json({ status: "UP", service: "insurance-service", database: dbStatus });
});

// ─── Country Search ───────────────────────────────────────────────────────────

router.get("/countries", countryController);
router.get("/countries/search", countryController);
router.post("/countries/search", countryController);

// ─── Insurance Flow ───────────────────────────────────────────────────────────

// Search — Standalone, Student, AMT, Embedded
// Auth required: prevents anonymous fare-locking which creates orphaned review records.
router.post("/search", authenticateJWT, searchController);

// Review — get bookingId (bid) for Book API
// Auth required: review locks a TripJack fare slot; must be tied to a real user.
router.post("/review", authenticateJWT, reviewController);

// Book — confirm insurance purchase + persist to DB
router.post("/book", authenticateJWT, bookController);

// Booking details — proxy TripJack status + optional DB sync
router.post("/booking-details", authenticateJWT, bookingDetailsController);

// ─── My Bookings ──────────────────────────────────────────────────────────────

router.get("/bookings",    authenticateJWT, listController);

// B2C guest booking history (email → OTP → history).
//
// Both MUST stay above "/bookings/:id" — Express matches in registration
// order, so declaring them after it would make ":id" swallow "check-email"
// and "history" as booking ids.
//
// check-email is public by necessity: it runs before the customer has a token,
// exactly like the Flight/Hotel/Cab checks the portal already calls.
router.get("/bookings/check-email", checkEmailController);

// history derives the customer from the verified guest token, never from the
// request, so an arbitrary email cannot be substituted after OTP.
router.get("/bookings/history", authenticateJWT, bookingHistoryController);

router.get("/bookings/:id", authenticateJWT, bookingDetailsFromDbController);

// ─── Amendments / Cancellation ────────────────────────────────────────────────

router.post("/amendment/raise",  authenticateJWT, raiseAmendmentController);
router.post("/amendment/cancel", authenticateJWT, cancelController);

export default router;

