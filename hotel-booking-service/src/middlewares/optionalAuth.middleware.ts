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

    if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      token = bearerMatch ? bearerMatch[1] : authHeader;
    } else if (req.query?.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      // No token — guest user, proceed without user context
      next();
      return;
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    // Invalid/expired token — treat as guest, proceed anyway
    next();
  }
};
