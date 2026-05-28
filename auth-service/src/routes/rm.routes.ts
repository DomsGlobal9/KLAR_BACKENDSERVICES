import { Router } from "express";
import {
    createRM,
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

export default router;