import { Router } from "express";
import { precheckController } from "../controllers/precheck.controller";
import { commitController } from "../controllers/commit.controller";
import { cancelController } from "../controllers/cancel.controller";
import { listController } from "../controllers/list.controller";
import { specialRequestsController } from "../controllers/special-requests.controller";
import { getBookings, getBookingDetails } from "../controllers/bookings.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", (_req, res) => {
    res.json({
        service: "hotel-booking-service",
        endpoints: {
            health: "GET /health",
            bookings: "GET /bookings",
            precheck: "POST /precheck",
            commit: "POST /commit",
            cancel: "POST /cancel",
            specialRequests: "GET /special-requests",
            bookingDetails: "GET /bookings/:id"
        }
    });
});

import mongoose from "mongoose";

router.get("/health", (_req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";
    res.json({
        status: "UP",
        service: "hotel-booking-service",
        database: dbStatus
    });
});

// List bookings from DB
router.get("/bookings", listController);

// RateGain booking flow — now protected
router.post("/precheck", authenticateJWT, precheckController);
router.post("/commit", authenticateJWT, commitController);
router.post("/cancel", authenticateJWT, cancelController);
router.get("/special-requests", authenticateJWT, specialRequestsController);

// New booking management routes
router.get("/bookings/:id", authenticateJWT, getBookingDetails);

export default router;
