import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { amendmentService } from "../services/amendment.service";

export const raiseAmendmentController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await amendmentService.raise(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][RaiseAmendment Error]", error?.message || error);
        const status  = error.status || error.response?.status || 500;
        const message = error.message || "Failed to raise amendment";
        const details = error.response?.data || null;
        res.status(status).json({ status: false, statusCode: status, message, details });
    }
};

export const cancelController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await amendmentService.cancel(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][Cancel Error]", error?.message || error);
        const status  = error.status || error.response?.status || 500;
        const message = error.message || "Cancellation failed";
        const details = error.response?.data || null;
        res.status(status).json({ status: false, statusCode: status, message, details });
    }
};
