import { Response, NextFunction } from "express";

import { Roles } from "../constants/roles";
import { envConfig } from "../config/env.config";
import { AuthenticatedRequest } from "./authentication.middleware";

/**
 * Guards the KLAR master-only pricing configuration.
 *
 * Two independent factors, both required:
 *   1. roles === MASTER on the token
 *   2. email is listed in MASTER_EMAILS
 *
 * Either one alone is a single point of failure for the most sensitive write
 * in the system — the platform markup is deliberately invisible to agents, so
 * an unauthorised change to it produces no complaint from anyone who would
 * notice. Requiring both means a DB compromise alone cannot grant it, and an
 * env leak alone cannot either.
 *
 * Fails closed: an empty MASTER_EMAILS locks everyone out rather than
 * degrading to a role-only check.
 *
 * Must run after authenticateJWT.
 */
export const requireMaster = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    const user = req.user;

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required.",
            code: "AUTH_REQUIRED",
        });
    }

    const allowlist = envConfig.MASTER.EMAILS;

    if (allowlist.length === 0) {
        console.error(
            "[requireMaster] MASTER_EMAILS is not configured. Rejecting master request."
        );
        return res.status(503).json({
            success: false,
            message: "Master access is not configured.",
            code: "MASTER_NOT_CONFIGURED",
        });
    }

    const hasRole = user.roles === Roles.MASTER;
    const isAllowlisted = allowlist.includes((user.email || "").toLowerCase());

    if (!hasRole || !isAllowlisted) {
        // Deliberately opaque to the caller: confirming which of the two
        // factors failed tells an attacker which half they still need.
        console.warn(
            `[requireMaster] Denied for ${user.email} (role=${user.roles}, allowlisted=${isAllowlisted})`
        );
        return res.status(403).json({
            success: false,
            message: "Forbidden",
        });
    }

    next();
};
