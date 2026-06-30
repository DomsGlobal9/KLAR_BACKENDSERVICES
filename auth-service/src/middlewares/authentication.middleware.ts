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
        console.log("🔑 Auth: Token extracted:", token ? `${token.substring(0, 20)}...` : "None");

        if (!token) {
            console.log("❌ Auth: No token found");
            return res.status(401).json({
                success: false,
                message: "Authentication required. No token provided.",
                code: "TOKEN_MISSING"
            });
        }

        const decoded = JWTUtil.getInstance().verifyAccessToken(token);
        console.log("✅ Auth: Token decoded for user:", decoded?.userId);

        if (!decoded || !decoded.userId || !decoded.email) {
            console.log("❌ Auth: Invalid token payload");
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
        console.log("❌ Auth: Error -", error.name || "Unknown error", error.message || "");

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
    console.log("🔍 Auth: Checking for token in cookie...");
    if (req.cookies?.token && typeof req.cookies.token === 'string') {
        console.log("✅ Auth: Token found in cookie");
        return req.cookies.token;
    }

    console.log("🔍 Auth: Checking for token in Authorization header...");
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
            console.log("✅ Auth: Token found in Authorization header");
            let token = bearerMatch[1];
            
            // Check if token is a JSON string with value property
            if (token.startsWith('{') && token.endsWith('}')) {
                try {
                    const parsed = JSON.parse(token);
                    token = parsed.value || parsed.token || parsed.accessToken || token;
                    console.log("🔑 Auth: Extracted token from JSON object");
                } catch (e) {
                    console.log("⚠️ Auth: Failed to parse JSON token, using as is");
                }
            }
            
            console.log("🔑 Auth: Token extracted:", token ? `${token.substring(0, 20)}...` : "None");
            return token;
        }
    }

    console.log("🔍 Auth: Checking for token in query parameter...");
    if (req.query?.token && typeof req.query.token === 'string') {
        console.log("✅ Auth: Token found in query parameter");
        let token = req.query.token;
        
        // Check if token is a JSON string with value property
        if (token.startsWith('{') && token.endsWith('}')) {
            try {
                const parsed = JSON.parse(token);
                token = parsed.value || parsed.token || parsed.accessToken || token;
                console.log("🔑 Auth: Extracted token from JSON object in query");
            } catch (e) {
                console.log("⚠️ Auth: Failed to parse JSON token from query, using as is");
            }
        }
        
        console.log("🔑 Auth: Token extracted:", token ? `${token.substring(0, 20)}...` : "None");
        return token;
    }

    console.log("❌ Auth: No token found in any source");
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