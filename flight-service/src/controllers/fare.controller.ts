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
            const { sessionId, flightKey } = req.body;

            let { legIndex } = req.body;

            if (Array.isArray(legIndex)) {
                legIndex = legIndex[0];
            }

            if (legIndex === undefined || !flightKey || !sessionId) {
                return res.status(400).json({
                    success: false,
                    message: "sessionId, legIndex and flightKey are required"
                });
            }

            const data = await FareService.getMultiCityFares(
                sessionId,
                Number(legIndex),
                flightKey
            );

            return res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
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