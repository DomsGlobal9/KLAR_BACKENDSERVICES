import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authentication.middleware";

export const authorizeRoles = (...allowedRoles: string[]) => {
    return (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const hasRole = allowedRoles.includes(req.user.roles);

        if (!hasRole) {
            return res.status(403).json({ message: "Access denied" });
        }

        next();
    };
};