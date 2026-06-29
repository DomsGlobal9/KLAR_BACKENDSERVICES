import { Request } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import { env } from "../config/env";
import { MarkupRule } from "./pricing.util";

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

/**
 * Extracts the bearer token (or raw token) from an Express request.
 * Priority: Authorization header (Bearer prefix) → raw header value → query.token
 * Returns null if no token can be found.
 */
export function extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        return bearerMatch ? bearerMatch[1] : authHeader;
    }

    if (req.query?.token && typeof req.query.token === 'string') {
        return req.query.token;
    }

    return null;
}

/**
 * Fetches the agent's markup rules from the auth service.
 * Returns an empty array if the token is null/undefined, on network error, or on any failure.
 * Never throws.
 */
export async function getMarkupRules(token: string | null): Promise<MarkupRule[]> {
    if (!token) {
        return [];
    }

    try {
        const response = await axios.get(`${env.authServiceUrl}/user/markup/my-markup`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data?.success) {
            return Array.isArray(response.data.data)
                ? response.data.data
                : (response.data.data?.services || []);
        }

        return [];
    } catch (err: any) {
        console.warn('[auth] getMarkupRules failed:', err?.message ?? err);
        return [];
    }
}
