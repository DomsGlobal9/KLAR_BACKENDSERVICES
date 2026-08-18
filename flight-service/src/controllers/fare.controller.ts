import { Request, Response } from "express";
import FareService from "../services/fare.service";

class FareController {

    async getFares(req: Request, res: Response) {
        try {
            const { sessionId, flightKey } = req.body;

            const data = await FareService.getFares(sessionId, flightKey);

            res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getReturnFares(req: Request, res: Response) {
        try {
            const { sessionId, flightKey, segment } = req.body;

            const data = await FareService.getReturnFares(sessionId, flightKey, segment);

            res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getMultiCityFares(req: Request, res: Response) {
        try {
            const { sessionId, optionId, flightKey, priceId } = req.body;

            let { legIndex } = req.body;

            if (Array.isArray(legIndex)) {
                legIndex = legIndex[0];
            }

            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    message: "sessionId is required"
                });
            }

            if (!optionId && !flightKey) {
                return res.status(400).json({
                    success: false,
                    message: "optionId is required (flightKey with legIndex is accepted for backward compatibility)"
                });
            }

            const data = await FareService.getMultiCityFares({
                sessionId,
                optionId,
                legIndex: legIndex === undefined ? undefined : Number(legIndex),
                flightKey,
                priceId
            });

            return res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message,
                errorCode: error.errorCode,
                details: error.details
            });
        }
    }

    async getFareRule(req: Request, res: Response) {
        try {
            const { flowType, id } = req.body;

            if (!flowType || !id) {
                return res.status(400).json({
                    success: false,
                    message: "flowType and id are required"
                });
            }

            const validFlowTypes = ["SEARCH", "REVIEW", "BOOKING_DETAIL"];

            if (!validFlowTypes.includes(flowType)) {
                return res.status(400).json({
                    success: false,
                    message: "flowType must be SEARCH, REVIEW, or BOOKING_DETAIL"
                });
            }

            const response = await FareService.getFareRule(flowType, id);

            return res.status(200).json(response);

        } catch (error: any) {


            return res.status(500).json({
                success: false,
                message: error.message || "Internal server error"
            });
        }
    }
}

export default new FareController();