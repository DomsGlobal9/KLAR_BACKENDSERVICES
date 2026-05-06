import { Request, Response, NextFunction } from "express";
import { amendService } from "../services/amend.service";

export const getModificationPolicy = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { confirmationNumber } = req.query;
        const result = await amendService.getModificationPolicy(confirmationNumber as string);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getModificationPricing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await amendService.getModificationPricing(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const commitModification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await amendService.commitModification(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
