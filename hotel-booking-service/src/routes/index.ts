import { Router } from "express";
import rateLimit from "express-rate-limit";
import { precheckController } from "../controllers/precheck.controller";
import { commitController } from "../controllers/commit.controller";
import {
  cancelController,
  getCancelChargesController,
} from "../controllers/cancel.controller";
import { processManualRefund } from "../controllers/refund.controller";
import { listController } from "../controllers/list.controller";
import { specialRequestsController } from "../controllers/special-requests.controller";
import { getPricingSummaryController } from "../controllers/pricing.controller";
import {
  getBookings,
  getBookingDetails,
  checkBookingsByEmail,
} from "../controllers/bookings.controller";
import { confirmController } from "../controllers/confirm.controller";
import { bookingTemplateController } from "../controllers/booking-template.controller";

import { authenticateJWT } from "../middlewares/auth.middleware";
import { optionalAuthenticateJWT } from "../middlewares/optionalAuth.middleware";

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

      bookingDetails: "GET /bookings/:id",
    },
  });
});

import mongoose from "mongoose";

router.get("/health", (_req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";
  res.json({
    status: "UP",
    service: "hotel-booking-service",
    database: dbStatus,
  });
});
// List bookings from DB
router.get("/bookings", authenticateJWT, listController);


// This endpoint is intentionally pre-auth (the guest flow asks "do you already
// have bookings, please log in"), so it's an unauthenticated existence oracle.
// Throttle hard to blunt email enumeration.
const emailCheckLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    statusCode: 429,
    description: "Too many requests. Please try again later.",
    body: null,
  },
});
router.get("/bookings/check/:email", emailCheckLimiter, checkBookingsByEmail);

import {
  getModificationPolicy,
  getModificationPricing,
  commitModification,
} from "../controllers/amend.controller";

// RateGain booking flow — optional auth for B2C guest users
router.post("/precheck", optionalAuthenticateJWT, precheckController);
router.post("/commit", optionalAuthenticateJWT, commitController);
router.post("/confirm", optionalAuthenticateJWT, confirmController);
router.post("/cancel", optionalAuthenticateJWT, cancelController);
router.get(
  "/cancel/charges",
  optionalAuthenticateJWT,
  getCancelChargesController,
);
router.post("/refund/manual/:bookingId", authenticateJWT, processManualRefund);
router.post("/pricing-summary", authenticateJWT, getPricingSummaryController);

router.get("/amend/policy", authenticateJWT, getModificationPolicy);
router.post("/amend/price", authenticateJWT, getModificationPricing);
router.post("/amend/commit", authenticateJWT, commitModification);
router.get("/special-requests", specialRequestsController);

// New booking management routes
router.get("/bookings/:id", optionalAuthenticateJWT, getBookingDetails);

/**
 * Client Confirmation Template Endpoint
 * GET -> /api/templates/hotel/confirmation/client/6a15467827cdbbb8d1982f82
 */
router.get(
  "/templates/hotel/confirmation/client/:id",
  authenticateJWT,
  bookingTemplateController.renderClientConfirmation,
);

/**
 * Agent Confirmation Template Endpoint
 * GET -> /api/templates/hotel/confirmation/agent/6a15467827cdbbb8d1982f82
 */
router.get(
  "/templates/hotel/confirmation/agent/:id",
  authenticateJWT,
  bookingTemplateController.renderAgentConfirmation,
);

export default router;
