import { Router } from "express";
import {
    createRM,
    getAllRMs,
    getRMById,
    updateRM,
    verifyCreateRMOTP,
} from "../controllers/rm.controller";

import { authorizeRoles } from "../middlewares/authorizeRoles.middleware";
import { authenticateJWT } from "../middlewares/authentication.middleware";

import { Roles } from "../constants/roles";

const router = Router();

/**
 * Send OTP for RM creation
 */
router.post("/create", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), createRM);

/**
 * Verify OTP and create RM
 */
router.post("/verify-create-otp", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), verifyCreateRMOTP);

/**
 * Get all RMs (B2B Admin only)
 */
router.get("/", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), getAllRMs);

/**
 * Get RM by ID (B2B Admin only)
 */
router.get("/:rmId", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), getRMById);

/**
 * Update RM
 */
router.put("/update/:rmId", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), updateRM);

export default router;