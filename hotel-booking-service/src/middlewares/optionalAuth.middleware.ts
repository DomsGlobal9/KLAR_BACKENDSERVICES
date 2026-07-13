import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthenticatedRequest } from "./auth.middleware";

/**
 * Optional JWT middleware — attaches user info if a valid token is present,
 * but allows the request to proceed without a token (for B2C guest users).
 */
export const optionalAuthenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | null = null;

    // Header-only: a JWT in the query string (?token=) leaks into logs, history
    // and Referer headers, so it is deliberately not read here.
    if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      token = bearerMatch ? bearerMatch[1] : authHeader;
    }

    if (!token) {
      // No token — guest user, proceed without user context
      next();
      return;
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (error: any) {
    // Invalid/expired token — treat as guest and proceed, but log it so a broken
    // session (e.g. a B2B user silently downgraded to guest) is not invisible.
    console.warn(
      `[optionalAuth] Ignoring invalid/expired token, continuing as guest: ${error?.message || error}`,
    );
    next();
  }
};
