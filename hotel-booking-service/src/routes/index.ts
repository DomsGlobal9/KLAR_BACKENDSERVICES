import { Router } from "express";
import { precheckController } from "../controllers/precheck.controller";
import { commitController } from "../controllers/commit.controller";
import { cancelController } from "../controllers/cancel.controller";
import { listController } from "../controllers/list.controller";
import { specialRequestsController } from "../controllers/special-requests.controller";
import { getBookings, getBookingDetails } from "../controllers/bookings.controller";
import { confirmController } from "../controllers/confirm.controller";
import { bookingTemplateController } from "../controllers/booking-template.controller";

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
            confirm: "POST /confirm",
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
router.get("/bookings", authenticateJWT, listController);

import { getModificationPolicy, getModificationPricing, commitModification } from "../controllers/amend.controller";

// RateGain booking flow — now protected
router.post("/precheck", authenticateJWT, precheckController);
router.post("/commit", authenticateJWT, commitController);
router.post("/confirm", authenticateJWT, confirmController);
router.post("/cancel", authenticateJWT, cancelController);


router.get("/amend/policy", authenticateJWT, getModificationPolicy);
router.post("/amend/price", authenticateJWT, getModificationPricing);
router.post("/amend/commit", authenticateJWT, commitModification);
router.get("/special-requests", specialRequestsController);

// New booking management routes
router.get("/bookings/:id", authenticateJWT, getBookingDetails);


/**
 * Client Confirmation Template Endpoint
 * GET -> /api/templates/hotel/confirmation/client/6a15467827cdbbb8d1982f82
 */
router.get(
    "/templates/hotel/confirmation/client/:id", 
    bookingTemplateController.renderClientConfirmation
);

/**
 * Agent Confirmation Template Endpoint
 * GET -> /api/templates/hotel/confirmation/agent/6a15467827cdbbb8d1982f82
 */
router.get(
    "/templates/hotel/confirmation/agent/:id", 
    bookingTemplateController.renderAgentConfirmation
);


export default router;
