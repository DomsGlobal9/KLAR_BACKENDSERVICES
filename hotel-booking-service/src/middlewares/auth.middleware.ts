import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Response | void => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    // Only accept the token from the Authorization header. A JWT in the query
    // string (?token=) leaks into access logs, browser history and Referer
    // headers, so it is deliberately not read here.
    if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      token = bearerMatch ? bearerMatch[1] : authHeader;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. No token provided.",
        code: "TOKEN_MISSING",
      });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      code: "AUTH_FAILED",
    });
  }
};
