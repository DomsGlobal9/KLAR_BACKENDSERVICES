import { Request, Response, NextFunction } from "express";
import { JWTUtil, TokenPayload } from "../utils/JWT";

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
}

export const authenticateJWT = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    // Try to get token from cookie first, then fall back to Authorization header
    let token: string | undefined = req.cookies?.token;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Authentication token missing" });
    }

    try {
        const decoded = JWTUtil.getInstance().verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
