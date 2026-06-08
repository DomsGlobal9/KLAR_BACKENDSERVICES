import { Request, Response, NextFunction } from "express";
import { JWTUtil, TokenPayload } from "../utils/JWT";

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
}

/**
 * Authentication middleware that extracts and verifies JWT token from multiple sources
 * Priority: Cookie > Authorization Header > Bearer Token > Query Parameter
 */
export const authenticateJWT = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    try {
        const token = extractTokenFromRequest(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. No token provided.",
                code: "TOKEN_MISSING"
            });
        }

        const decoded = JWTUtil.getInstance().verifyAccessToken(token);

        if (!decoded || !decoded.userId || !decoded.email) {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload",
                code: "INVALID_PAYLOAD"
            });
        }

        req.user = decoded;

        if (process.env.NODE_ENV === 'development') {
            console.log(`User authenticated: ${decoded.userId} (${decoded.email})`);
        }

        next();
    } catch (error: any) {

        if (error instanceof Error) {
            switch (error.name) {
                case 'TokenExpiredError':
                    return res.status(401).json({
                        success: false,
                        message: "Token has expired",
                        code: "TOKEN_EXPIRED"
                    });

                case 'JsonWebTokenError':
                    return res.status(401).json({
                        success: false,
                        message: "Invalid token signature",
                        code: "INVALID_TOKEN"
                    });

                case 'NotBeforeError':
                    return res.status(401).json({
                        success: false,
                        message: "Token not yet active",
                        code: "TOKEN_NOT_ACTIVE"
                    });

                default:
                    return res.status(401).json({
                        success: false,
                        message: "Authentication failed",
                        code: "AUTH_FAILED",
                        error: process.env.NODE_ENV === 'development' ? error.message : undefined
                    });
            }
        }

        return res.status(401).json({
            success: false,
            message: "Authentication failed",
            code: "AUTH_FAILED"
        });
    }
};

/**
 * Extract token from various request sources
 * Priority: Cookie > Authorization Header > Query Parameter
 */
function extractTokenFromRequest(req: Request): string | null {

    if (req.cookies?.token && typeof req.cookies.token === 'string') {
        return req.cookies.token;
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
            return bearerMatch[1];
        }
    }

    if (req.query?.token && typeof req.query.token === 'string') {
        return req.query.token;
    }

    return null;
}


/**
 * Basic JWT format validation
 * JWT should have 3 parts separated by dots
 */
function isValidJWTFormat(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3;
}

