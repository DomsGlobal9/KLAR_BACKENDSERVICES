import { Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function getClientType(req: Request): "B2B" | "B2C" {
    try {
        const authHeader = req.headers.authorization;
        let token = null;

        if (authHeader) {
            const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
            token = bearerMatch ? bearerMatch[1] : authHeader;
        } else if (req.query?.token && typeof req.query.token === 'string') {
            token = req.query.token;
        }

        if (token) {
            const decoded = jwt.verify(token, env.jwtSecret) as any;
            if (decoded && decoded.clientType?.toUpperCase() === "B2B") {
                return "B2B";
            }
        }
    } catch (err) {
        // Ignore and fallback to B2C
    }
    return "B2C";
}
