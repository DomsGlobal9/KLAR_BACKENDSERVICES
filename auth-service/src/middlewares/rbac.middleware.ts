import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";

export const authorizeRoles = (...allowedRoles: string[]) => {
    return (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const hasRole = req.user.roles.some(role =>
            allowedRoles.includes(role)
        );

        if (!hasRole) {
            return res.status(403).json({ message: "Access denied" });
        }

        next();
    };
};
