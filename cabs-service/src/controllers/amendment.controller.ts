import { Request, Response, NextFunction } from "express";
import { amendmentService } from "../services/amendment.service";

export const getAmendmentCharges = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bookingId, type } = req.query;
        const result = await amendmentService.getCharges(bookingId as string, type as string);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const processCancellation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await amendmentService.processCancellation(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
