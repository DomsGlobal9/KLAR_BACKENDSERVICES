import { Request, Response, NextFunction } from "express";
import { hotelsService } from "../services/hotels.service";
import { getClientType } from "../utils/auth";

export const searchHotels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const clientType = getClientType(req);
        const data = await hotelsService.searchHotels(req.body, clientType);
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

export const getHotelSuggestions = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const query = req.query.q as string;
        const data = await hotelsService.getHotelSuggestions(query);
        res.status(200).json({
            status: true,
            body: data
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            description: error.message,
            body: []
        });
    }
};
