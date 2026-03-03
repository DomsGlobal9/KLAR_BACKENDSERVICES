import { Request, Response, NextFunction } from "express";
import {
    getReviewFromTripJack,
    transformReviewResponse,
    validateReviewRequest,
    getBatchReview
} from "../services/tripjackReviewService";
import { ReviewError, TransformedReviewPrice } from "../interface/flight/review.interface";

export const getPriceReview = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { priceIds } = req.body;

        if (!validateReviewRequest(priceIds)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request. Expected { priceIds: string[] } with at least one price ID"
            });
        }

        const reviewData = await getReviewFromTripJack({ priceIds });

        if (!reviewData.status?.success) {
            return res.status(400).json({
                success: false,
                message: "Review API returned error",
                error: reviewData
            });
        }

        const transformedData = transformReviewResponse(reviewData, { priceIds });
        if (!transformedData) {
            return res.status(400).json({
                success: false,
                message: "Error while getting review data"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Price review fetched successfully",
            data: transformedData
        });

    } catch (error: any) {

        if (error.response?.status === 404) {
            return res.status(404).json({
                success: false,
                message: "Price IDs not found or expired"
            });
        }

        if (error.response?.status === 400) {
            return res.status(400).json({
                success: false,
                message: error.response?.data?.message || "Invalid price IDs"
            });
        }

        next(error);
    }
};

export const getBatchPriceReview = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { requests } = req.body;

        if (!Array.isArray(requests) || requests.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid request. Expected { requests: ReviewRequest[] }"
            });
        }

        for (const request of requests) {
            if (!validateReviewRequest(request.priceIds)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid priceIds in one of the requests"
                });
            }
        }

        const results = await getBatchReview(requests);

        const successful = results.filter(r => !('error' in r)) as TransformedReviewPrice[];
        const failed = results.filter(r => 'error' in r) as ReviewError[];

        return res.status(200).json({
            success: true,
            message: "Batch review fetched successfully",
            data: {
                successful,
                failed,
                summary: {
                    total: results.length,
                    successful: successful.length,
                    failed: failed.length
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

export const getPriceReviewWithRules = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { priceIds } = req.body;

        if (!validateReviewRequest(priceIds)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request. Expected { priceIds: string[] }"
            });
        }

        const reviewData = await getReviewFromTripJack({ priceIds });

        if (!reviewData.status?.success) {
            return res.status(400).json({
                success: false,
                message: "Review API returned error",
                error: reviewData
            });
        }

        const transformedData = transformReviewResponse(reviewData, { priceIds });

        return res.status(200).json({
            success: true,
            message: "Price review fetched successfully",
            data: {
                ...transformedData,
            }
        });

    } catch (error) {
        next(error);
    }
};