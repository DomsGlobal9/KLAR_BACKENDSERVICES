import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { listService } from "../services/list.service";

export const listController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const agentId = req.user?.userId || req.user?.id || req.user?._id;
        const data = await listService.list({
            agentId,
            status:      req.query.status      as string,
            journeyType: req.query.journeyType as string,
            page:        Number(req.query.page)  || 1,
            limit:       Number(req.query.limit) || 20,
        });
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][List Error]", error?.message || error);
        const status = error.status || 500;
        res.status(status).json({ status: false, statusCode: status, message: error.message || "Failed to list bookings" });
    }
};
