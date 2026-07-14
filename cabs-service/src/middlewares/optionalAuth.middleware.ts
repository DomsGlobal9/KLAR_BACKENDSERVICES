import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthenticatedRequest } from "./auth.middleware";

/**
 * Optional JWT middleware — attaches `req.user` when a valid token is present,
 * but lets the request proceed without one (B2C guest cab bookings). Ported from
 * hotel-booking-service.
 */
export const optionalAuthenticateJWT = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | null = null;

    // Header-only: a JWT in the query string leaks into logs/history/Referer.
    if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      token = bearerMatch ? bearerMatch[1] : authHeader;
    }

    if (!token) {
      next(); // guest — proceed without user context
      return;
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.warn(
      `[optionalAuth] Ignoring invalid/expired token, continuing as guest: ${error?.message || error}`,
    );
    next();
  }
};
