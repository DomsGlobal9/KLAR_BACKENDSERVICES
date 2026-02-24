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
        // Extract token from various possible sources
        const token = extractTokenFromRequest(req);
        console.log("***((((((((((",token);

        // Check if token exists
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: "Authentication required. No token provided.",
                code: "TOKEN_MISSING"
            });
        }

        // Validate token format (basic JWT format check)
        if (!isValidJWTFormat(token)) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token format",
                code: "INVALID_TOKEN_FORMAT"
            });
        }

        // Verify the token
        const decoded = JWTUtil.getInstance().verifyAccessToken(token);
        console.log("!!!!@!@!@!@!@@!@@2121",decoded);
        
        // Check if token payload contains required user information
        if (!decoded || !decoded.userId || !decoded.email) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token payload",
                code: "INVALID_PAYLOAD"
            });
        }

        // Attach user info to request object
        req.user = decoded;
        
        // Log authentication for debugging (optional, remove in production)
        if (process.env.NODE_ENV === 'development') {
            console.log(`User authenticated: ${decoded.userId} (${decoded.email})`);
        }

        // Proceed to next middleware
        next();
    } catch (error) {
        // Handle specific JWT errors
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
    // 1. Check cookies first (most secure for web apps)
    if (req.cookies?.token && typeof req.cookies.token === 'string') {
        return req.cookies.token;
    }

    // 2. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader) {
        // Check for Bearer token format
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
            return bearerMatch[1];
        }
        
        // Also support raw token in Authorization header
        return authHeader;
    }

    // 3. Check query parameter (less secure, but useful for certain scenarios like email verification)
    if (req.query?.token && typeof req.query.token === 'string') {
        return req.query.token;
    }

    // 4. Check body (use with caution, only for specific endpoints)
    if (req.body?.token && typeof req.body.token === 'string') {
        return req.body.token;
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

