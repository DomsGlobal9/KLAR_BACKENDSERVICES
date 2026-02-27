import { Request, Response, NextFunction } from "express";
import { hotelsService } from "../services/hotels.service";

export const searchHotels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const data = await hotelsService.searchHotels(req.body);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message,
            body: []
        });
    }
};
