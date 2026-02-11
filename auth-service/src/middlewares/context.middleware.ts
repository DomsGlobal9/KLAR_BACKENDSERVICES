import { Request, Response, NextFunction } from "express";
import { ClientType } from "../constants/clientTypes";

export interface ContextRequest extends Request {
    clientType?: ClientType;
}

export const contextResolver = (
    req: ContextRequest,
    _res: Response,
    next: NextFunction
) => {
    const path = req.path.split("/")[1];

    // Bypass context resolution for health check and admin routes
    if (path === "health" || path === "admin") {
        return next();
    }

    if (
        path === ClientType.B2C ||
        path === ClientType.B2B ||
        path === ClientType.B2B2B
    ) {
        req.clientType = path as ClientType;
        return next();
    }

    return next(new Error(`Invalid client type: ${path}`));
};
