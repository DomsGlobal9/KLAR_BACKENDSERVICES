import { Router } from "express";
import mongoose from "mongoose";
import { authenticateJWT } from "../middlewares/auth.middleware";

import { searchController }            from "../controllers/search.controller";
import { reviewController }            from "../controllers/review.controller";
import { bookController }              from "../controllers/book.controller";
import { bookingDetailsController, bookingDetailsFromDbController } from "../controllers/bookingDetails.controller";
import { listController }              from "../controllers/list.controller";
import { raiseAmendmentController, cancelController } from "../controllers/amendment.controller";

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/", (_req, res) => {
    res.json({
        service: "insurance-service",
        version: "1.0.0",
        endpoints: {
            health:         "GET  /health",
            search:         "POST /search",
            review:         "POST /review",
            book:           "POST /book",
            bookingDetails: "POST /booking-details",
            bookings:       "GET  /bookings",
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

// ─── Insurance Flow ───────────────────────────────────────────────────────────

// Search — Standalone, Student, AMT, Embedded
router.post("/search", searchController);

// Review — get bookingId (bid) for Book API
router.post("/review", reviewController);

// Book — confirm insurance purchase + persist to DB
router.post("/book", authenticateJWT, bookController);

// Booking details — proxy TripJack status + optional DB sync
router.post("/booking-details", authenticateJWT, bookingDetailsController);

// ─── My Bookings ──────────────────────────────────────────────────────────────

router.get("/bookings",    authenticateJWT, listController);
router.get("/bookings/:id", authenticateJWT, bookingDetailsFromDbController);

// ─── Amendments / Cancellation ────────────────────────────────────────────────

router.post("/amendment/raise",  authenticateJWT, raiseAmendmentController);
router.post("/amendment/cancel", authenticateJWT, cancelController);

export default router;
