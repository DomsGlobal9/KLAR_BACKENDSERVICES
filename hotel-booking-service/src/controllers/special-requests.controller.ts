import { Request, Response } from "express";
import { specialRequestsService } from "../services/special-requests.service";

export const specialRequestsController = async (_req: Request, res: Response) => {
    try {
        const data = await specialRequestsService.getSpecialRequests();
        res.json(data);
    } catch (error: any) {
        console.error("SpecialRequests Controller Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.message || "Internal Server Error",
            body: null
        });
    }
};
