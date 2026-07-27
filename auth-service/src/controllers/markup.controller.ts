import { Response, NextFunction, RequestHandler, Request } from 'express';
import { Types } from 'mongoose';
import { MarkupService } from '../services/markup.service';
import { AuthenticatedRequest } from '../middlewares/authentication.middleware';

const service = new MarkupService();

const asyncHandler = (fn: RequestHandler): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export class MarkupController {

    static addMarkup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false });

        const data = await service.upsert(
            new Types.ObjectId(userId),
            req.body
        );

        res.status(201).json({ success: true, data });
    });

    static getMyMarkups = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false });

        const serviceType = typeof req.query.serviceType === 'string'
            ? req.query.serviceType.trim()
            : undefined;

        const data = await service.getAll(
            new Types.ObjectId(userId),
            serviceType
        );

        res.json({ success: true, data });
    });

    static bulkUpdate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false });

        const data = await service.bulkUpsert(
            new Types.ObjectId(userId),
            req.body
        );

        res.json({ success: true, data });
    });

    static deleteOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false });

        const serviceTypeParam = req.params.serviceType;

        const serviceType = Array.isArray(serviceTypeParam)
            ? serviceTypeParam[0]
            : serviceTypeParam;

        if (!serviceType) {
            return res.status(400).json({ success: false });
        }

        const trimmedServiceType = serviceType.trim();

        if (!serviceType) {
            return res.status(400).json({ success: false });
        }

        // Region is a query param so the existing DELETE /:serviceType route
        // keeps working; omitting it targets the ALL rule.
        const region =
            typeof req.query.region === "string" ? req.query.region : undefined;

        await service.delete(
            new Types.ObjectId(userId),
            trimmedServiceType,
            region
        );

        res.json({ success: true });
    });

    static deleteByServiceId = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {

            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { serviceId } = req.params;

            if (!serviceId || !Types.ObjectId.isValid(serviceId as string)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid serviceId"
                });
            }

            await service.deleteByServiceId(
                new Types.ObjectId(userId),
                new Types.ObjectId(serviceId as string)
            );

            res.json({
                success: true,
                message: "Markup deleted successfully"
            });
        }
    );


    static getMonthlyRevenue = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false });

        const monthsBack = Number(req.query.monthsBack) || 12;

        const data = await service.getMonthlyMarkupRevenue(
            new Types.ObjectId(userId),
            monthsBack
        );

        res.json({ success: true, data });
    });


    static getMarkupByUserAndType = asyncHandler(async (req: Request, res: Response) => {





        const userId = req.body.userId;



        if (!userId) {

            return res.status(401).json({
                success: false,
                message: "userId is required"
            });
        }

        const { serviceType } = req.params;



        if (!serviceType) {

            return res.status(400).json({
                success: false,
                message: "serviceType is required"
            });
        }



        const data = await service.getMarkupByUserAndType(
            new Types.ObjectId(userId as string),
            serviceType as string,
        );





        res.json({
            success: true,
            data
        });
    });

}