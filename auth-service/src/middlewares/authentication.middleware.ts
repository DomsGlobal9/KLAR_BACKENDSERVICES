import { Request, Response, NextFunction } from "express";
import { JWTUtil, TokenPayload } from "../utils/JWT";

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
}

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

function extractTokenFromRequest(req: Request): string | null {
    if (req.cookies?.token && typeof req.cookies.token === 'string') {
        return req.cookies.token;
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
            let token = bearerMatch[1];

            if (token.startsWith('{') && token.endsWith('}')) {
                try {
                    const parsed = JSON.parse(token);
                    token = parsed.value || parsed.token || parsed.accessToken || token;
                } catch (e) {
                    // Failed to parse JSON, use as is
                }
            }

            return token;
        }
    }

    if (req.query?.token && typeof req.query.token === 'string') {
        let token = req.query.token;

        if (token.startsWith('{') && token.endsWith('}')) {
            try {
                const parsed = JSON.parse(token);
                token = parsed.value || parsed.token || parsed.accessToken || token;
            } catch (e) {
                // Failed to parse JSON, use as is
            }
        }

        return token;
    }

    return null;
}

function isValidJWTFormat(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3;
}