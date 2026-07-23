import { Request, Response, RequestHandler } from "express";
import { Types } from "mongoose";

import { MarkupConfigService } from "../services/markup-config.service";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";

const service = new MarkupConfigService();

const asyncHandler = (fn: RequestHandler): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export class MarkupConfigController {

    /** MASTER only. Full view of both scopes. */
    static list = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        const data = await service.getAll();
        res.json({ success: true, data });
    });

    /** MASTER only. Upsert one (scope, serviceType) rule. */
    static upsert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const masterId = req.user?.userId;
        if (!masterId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        try {
            const data = await service.upsert(
                new Types.ObjectId(masterId),
                req.body
            );
            res.json({ success: true, data });
        } catch (err: any) {
            // Validation failures here are master typos, not system faults —
            // surface the reason rather than a generic 500.
            res.status(400).json({
                success: false,
                message: err?.message || "Invalid markup configuration",
            });
        }
    });

    /** MASTER only. Delete one (scope, serviceType) rule. */
    static delete = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const masterId = req.user?.userId;
        if (!masterId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { scope, serviceType, region } = req.query;

        try {
            await service.delete(
                scope as string,
                serviceType as string,
                region as string | undefined
            );
            res.json({ success: true });
        } catch (err: any) {
            res.status(400).json({
                success: false,
                message: err?.message || "Invalid delete request",
            });
        }
    });

    /**
     * INTERNAL only (shared-secret gated, no user token).
     *
     * Never mount this behind authenticateJWT: any agent token would then be
     * able to read the platform markup and subtract it from the api price,
     * which is the exact disclosure this whole design exists to prevent.
     */
    static resolve = asyncHandler(async (req: Request, res: Response) => {
        const serviceType =
            typeof req.query.serviceType === "string"
                ? req.query.serviceType.trim()
                : "";

        if (!serviceType) {
            return res.status(400).json({
                success: false,
                message: "serviceType is required",
            });
        }

        // Absent region resolves the ALL catch-all, which is what a caller that
        // has not been taught about regions yet expects.
        const region =
            typeof req.query.region === "string" ? req.query.region.trim() : "";

        const data = await service.resolve(serviceType, region);
        res.json({ success: true, data });
    });
}
