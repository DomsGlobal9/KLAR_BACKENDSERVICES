import { Router } from "express";
import { createRM } from "../controllers/rm.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles.middleware";
import { authenticateJWT } from "../middlewares/authentication.middleware";

import { Roles } from "../constants/roles";

const router = Router();

/**
 * Create RM
 */
router.post("/create", authenticateJWT, authorizeRoles(Roles.B2B_ADMIN), createRM);

export default router;