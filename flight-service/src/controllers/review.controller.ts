import { Request, Response } from "express";
import ReviewService from "../services/review.service";

class ReviewController {

    async review(req: Request, res: Response) {
        try {
            const { priceIds } = req.body;

            if (!priceIds || !Array.isArray(priceIds) || priceIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "priceIds is required and must be a non-empty array"
                });
            }

            const data = await ReviewService.reviewFare(priceIds);

            return res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Review API failed"
            });
        }
    }

    async reviewVerify(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "priceIds is required and must be a non-empty array"
                });
            }

            const data = await ReviewService.beforeBookVerify(bookingId);

            return res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Verify API failed"
            });
        }
    }
}

export default new ReviewController();