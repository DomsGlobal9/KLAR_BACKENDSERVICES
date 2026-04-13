import { Request, Response, NextFunction, RequestHandler } from 'express';
import { MarkupService } from '../services/markup.service';
import { AuthenticatedRequest } from '../middlewares/authentication.middleware';
import { Types } from 'mongoose';

console.log("✅ MarkupController file loaded successfully");

// Reusable Async Handler (Best Practice)
const asyncHandler = (fn: RequestHandler): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
export class MarkupController {

    static addMarkup = asyncHandler(async (req: AuthenticatedRequest, res: Response,  next: NextFunction) => {
        console.log("🚀 addMarkup CONTROLLER ACTUALLY CALLED via Express");
        // console.log("Has next?", typeof n);

        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const data = await MarkupService.upsert(new Types.ObjectId(userId), req.body);

        res.status(201).json({
            success: true,
            message: "Markup added/updated successfully",
            data
        });
    });


    /** GET - Get My Markups */
    static getMyMarkups = asyncHandler(async (req: AuthenticatedRequest, res: Response,   next: NextFunction) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const data = await MarkupService.getAll(new Types.ObjectId(userId));
        res.json({ success: true, data });
    });

    /** PUT - Bulk Update */
    static bulkUpdate = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { markups, appliedTo } = req.body;

        const data = await MarkupService.bulkUpsert(
            new Types.ObjectId(userId),
            { markups, appliedTo }
        );

        res.json({ success: true, message: 'Markups updated successfully', data });
    });

    /** DELETE - Delete One Service Markup */
    /** DELETE - Delete One Service Markup */
    static deleteOne = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        // Fixed: Handle string | string[] type safely
        let serviceType = req.params.serviceType;

        if (Array.isArray(serviceType)) {
            serviceType = serviceType[0]; // Take first value if array
        }

        if (!serviceType || typeof serviceType !== 'string') {
            return res.status(400).json({
                success: false,
                message: "serviceType is required and must be a string"
            });
        }

        const trimmedServiceType = serviceType.trim();

        if (!trimmedServiceType) {
            return res.status(400).json({
                success: false,
                message: "serviceType cannot be empty"
            });
        }

        await MarkupService.delete(
            new Types.ObjectId(userId),
            trimmedServiceType
        );

        res.json({ success: true, message: 'Markup deleted successfully' });
    });

    /** GET - Monthly Revenue */
    static getMonthlyRevenue = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const monthsBack = Number(req.query.monthsBack) || 12;

        const data = await MarkupService.getMonthlyMarkupRevenue(
            new Types.ObjectId(userId),
            monthsBack
        );

        res.json({ success: true, data });
    });
}