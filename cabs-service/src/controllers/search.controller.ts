import { Request, Response, NextFunction } from "express";
import { searchService } from "../services/search.service";

export const locationSearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { input } = req.body;
        const result = await searchService.locationSearch(input);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getLatLong = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { placeId } = req.body;
        const result = await searchService.getLatLong(placeId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getQuotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await searchService.getQuotes(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
