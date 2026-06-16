import { Router } from "express";
import {
    createCompany,
    verifyCreateCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
} from "../controllers/company.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles.middleware";
import { authenticateJWT } from "../middlewares/authentication.middleware";
import { Roles } from "../constants/roles";

const router = Router();

/**
 * Send OTP for company creation (B2B_ADMIN only)
 */
router.post("/create", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), createCompany);

/**
 * Verify OTP and create sub-company (B2B_ADMIN only)
 */
router.post("/verify-create-otp", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), verifyCreateCompany);

/**
 * Get all sub-companies created by this B2B_ADMIN
 */
router.get("/", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), getAllCompanies);

/**
 * Get sub-company by ID
 */
router.get("/:companyId", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), getCompanyById);

/**
 * Update sub-company
 */
router.put("/update/:companyId", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), updateCompany);


export default router;