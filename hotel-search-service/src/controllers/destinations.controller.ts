import { Request, Response, NextFunction } from "express";
import { destinationsService } from "../services/destinations.service";

export const getDestinations = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const data = await destinationsService.getDestinations();
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
