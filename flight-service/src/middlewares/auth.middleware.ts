import { NextFunction, Request, Response } from "express";
import axios from "axios";
import { envConfig } from "../config/env.config";

/**
 * Authentication for the flight service (C-3).
 *
 * `flight-service` previously mounted no auth middleware at all — booking,
 * hold, confirm, booking-details and cancellation were reachable by anyone who
 * could route to the service. Two controllers validated tokens inline; every
 * other route was open.
 *
 * This deliberately reuses the project's existing mechanism — auth-service's
 * `/auth/validate-token` — rather than introducing a second authentication
 * system, and mirrors the token handling already written in
 * bookingLocal.controller so behaviour is identical for callers that work today.
 */

export interface AuthenticatedUser {
    id: string;
    email?: string;
    roles: string[];
    clientType: string;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

/**
 * Some clients store the token as a JSON-wrapped `{ value, expiry }` blob.
 * The existing controllers unwrap it, so the middleware must too or those
 * callers would start failing.
 */
function unwrapToken(raw: string): string {
    if (!raw) return raw;
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) return trimmed;
    try {
        const parsed = JSON.parse(trimmed);
        return parsed.value || parsed.token || trimmed;
    } catch {
        return trimmed;
    }
}

export function extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        return token ? unwrapToken(token) : null;
    }

    const cookieToken = (req as any).cookies?.token;
    if (cookieToken) return unwrapToken(cookieToken);

    return null;
}

/** Validate a token against auth-service and normalise the user it describes. */
export async function validateToken(token: string): Promise<AuthenticatedUser> {
    const response = await axios.post(
        `${envConfig.AUTH_SERVICE}/auth/validate-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.data?.success) {
        throw new Error("Token validation failed");
    }

    const data = response.data.data || {};
    const id = data.userId || data.id || data._id;
    if (!id) {
        throw new Error("No user ID in token validation response");
    }

    return {
        id: String(id),
        email: data.email,
        roles: data.roles || ["user"],
        clientType: data.clientType || "b2c",
    };
}

/**
 * Require a valid token. Attaches `req.user` for downstream ownership checks.
 */
export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const token = extractToken(req);

    if (!token) {
        res.status(401).json({
            success: false,
            message: "Authorization token missing",
        });
        return;
    }

    try {
        req.user = await validateToken(token);
        next();
    } catch (error: any) {
        res.status(401).json({
            success: false,
            message:
                error?.response?.data?.message || error?.message || "Authentication failed",
        });
    }
}

/** Roles permitted to read or act on a booking they do not personally own. */
const PRIVILEGED_ROLES = new Set(["admin", "super_admin", "superadmin", "agency_admin"]);

export function isPrivileged(user?: AuthenticatedUser): boolean {
    if (!user?.roles?.length) return false;
    return user.roles.some((role) => PRIVILEGED_ROLES.has(String(role).toLowerCase()));
}

/**
 * Whether `user` may act on `booking`.
 *
 * Ownership is the booking's `userInfo.id`, which is what the booking is
 * created with. Privileged roles retain their existing cross-account access so
 * this does not break admin tooling.
 */
export function canAccessBooking(user: AuthenticatedUser | undefined, booking: any): boolean {
    if (!user) return false;
    if (isPrivileged(user)) return true;
    const ownerId = booking?.userInfo?.id;
    return !!ownerId && String(ownerId) === String(user.id);
}
