import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";



export interface AuthenticatedRequest extends Request {
    user?: any;
}


export const authenticateJWT = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    try {

        if (req.body?.source === "B2C_PORTAL" || req.query?.source === "B2C_PORTAL") {
            return next();
        }

        const authHeader = req.headers.authorization;
        console.log("auth.middleware.ts insurance", authHeader)
        let token: string | null = null;

        if (authHeader) {
            const match = authHeader.match(/^Bearer\s+(.+)$/i);
            token = match ? match[1] : authHeader;
        } else if (req.query?.token && typeof req.query.token === "string") {
            token = req.query.token;
        }

        // 1. Guard check: If token is missing, exit early
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. No token provided.",
                code: "TOKEN_MISSING",
            });
        }

        // ===== BACKEND TTL OBJECT UNWRAPPER SAFEGUARD =====
        // 2. We can safely use token.trim() now because TypeScript knows it's not null here
        if (token.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(token);
                // Fall back to the original token string if properties are missing
                token = parsed.value || parsed.token || token;
            } catch (e) {
                console.error("Failed parsing stringified token wrapper payload:", e);
            }
        }

        // 3. Create a strictly typed string variable so TypeScript is 100% confident down the line
        const activeToken: string = token ?? "";

        console.log("Cleaned token parsing trace:", activeToken.substring(0, 25) + "...");

        const decoded = jwt.verify(activeToken, env.jwtSecret);
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