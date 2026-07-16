import { Request, Response, NextFunction } from "express";
import { amendmentService } from "../services/amendment.service";
import { resolveCaller } from "../utils/ownership.util";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export const getAmendmentCharges = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { bookingId, type } = req.query;
        const caller = resolveCaller(req);
        const result = await amendmentService.getCharges(bookingId as string, type as string, caller);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const processCancellation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const caller = resolveCaller(req);
        const result = await amendmentService.processCancellation(req.body, caller);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
