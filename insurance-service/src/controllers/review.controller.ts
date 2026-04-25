import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { reviewService } from "../services/review.service";

export const reviewController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await reviewService.review(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][Review Error]", error?.message || error);
        const status  = error.status || error.response?.status || 500;
        const message = error.message || "Review failed";
        const details = error.response?.data || null;
        res.status(status).json({ status: false, statusCode: status, message, details });
    }
};
