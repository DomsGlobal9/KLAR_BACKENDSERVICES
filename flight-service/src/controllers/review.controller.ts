import { Request, Response } from "express";
import ReviewService from "../services/review.service";

class ReviewController {

    async review(req: Request, res: Response) {
        
        try {
            const { priceIds, sessionId, selections, optionIds } = req.body;

            const requestedSelections = selections || optionIds;

            let resolvedPriceIds: string[] = priceIds;
            let selectionSummary: unknown;

            if (sessionId && Array.isArray(requestedSelections)) {
                const resolution = await ReviewService.resolveMulticityPriceIds(
                    sessionId,
                    requestedSelections
                );
                resolvedPriceIds = resolution.priceIds;
                selectionSummary = resolution.resolved;
            }

            if (!resolvedPriceIds || !Array.isArray(resolvedPriceIds) || resolvedPriceIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Provide sessionId with selections, or a non-empty priceIds array"
                });
            }

            const data = await ReviewService.reviewFare(resolvedPriceIds);

            return res.status(200).json({
                success: true,
                data: selectionSummary ? { ...data, selection: selectionSummary } : data
            });

        } catch (error: any) {
            if (error.statusCode) {
                return res.status(error.statusCode).json({
                    success: false,
                    message: error.message,
                    errorCode: error.errorCode,
                    details: error.details,
                    referenceId: error.referenceId
                });
            }

            if (error.response?.status === 400) {
                const errorData = error.response?.data;

                if (errorData?.errors && errorData.errors.length > 0) {
                    const errorDetail = errorData.errors[0];

                    return res.status(400).json({
                        success: false,
                        message: errorDetail.message || "Flight is no longer available",
                        errorCode: errorDetail.errCode,
                        details: errorDetail.details,
                        referenceId: errorDetail.id,
                        httpStatus: errorData.status?.httpStatus
                    });
                }
            }

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