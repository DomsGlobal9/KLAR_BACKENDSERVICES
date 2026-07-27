import { Request, Response } from "express";
import CancellationService from "../services/cancellation.service";
import { mapToAmendmentPayload } from "../utils/mappers/cancellation.mapper";
import { validateCancellationPayload } from "../utils/cancellationVerifier";

class CancellationController {
    async getCharges(req: Request, res: Response) {
        try {
            const payload = mapToAmendmentPayload(req.body);

            validateCancellationPayload(payload);

            const response = await CancellationService.getCharges(payload);


            return res.status(200).json({
                success: true,
                data: response,
            });

        } catch (error: any) {


            // ✅ Handle your custom thrown error from service
            if (error?.httpStatus) {
                return res.status(error.httpStatus).json({
                    success: false,
                    ...error.raw   // 🔥 send full Tripjack response
                });
            }

            // fallback
            return res.status(500).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    }

    async submit(req: Request, res: Response) {
        try {
            const payload = mapToAmendmentPayload(req.body);

            validateCancellationPayload(payload);

            const response = await CancellationService.submit(payload);

            return res.status(200).json({
                success: true,
                data: response.data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async status(req: Request, res: Response) {
        try {
            const { amendmentId } = req.body;

            const response = await CancellationService.status(amendmentId);

            return res.status(200).json({
                success: true,
                data: response.data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}

export default new CancellationController();