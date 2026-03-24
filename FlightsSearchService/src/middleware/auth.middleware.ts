import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { envConfig } from "../config/env";

export interface AuthenticatedRequest extends Request {
    user?: any;
}

export const authenticateJWT = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    try {
        const authHeader = req.headers.authorization;
        let token = null;

        if (authHeader) {
            const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
            token = bearerMatch ? bearerMatch[1] : authHeader;
        } else if (req.query?.token && typeof req.query.token === 'string') {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: "Authentication required. No token provided.",
                code: "TOKEN_MISSING"
            });
        }

        const decoded = jwt.verify(token, envConfig.JWT.SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ 
                success: false,
                message: "Token has expired",
                code: "TOKEN_EXPIRED"
            });
        }
        
        return res.status(401).json({ 
            success: false,
            message: "Authentication failed",
            code: "AUTH_FAILED"
        });
    }
};
