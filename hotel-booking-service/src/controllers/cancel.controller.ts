import { Request, Response } from "express";
import { cancelService } from "../services/cancel.service";

export const cancelController = async (req: Request, res: Response) => {
    try {
        const data = await cancelService.cancel(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("Cancel Controller Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message || "Internal Server Error",
            body: null
        });
    }
};
