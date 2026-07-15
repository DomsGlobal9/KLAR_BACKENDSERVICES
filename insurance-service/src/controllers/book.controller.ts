import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { bookService } from "../services/book.service";

export const bookController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const agentId   = req.user?.userId || req.user?.id || req.user?._id || "guest_user";
        const agentName = req.user?.email || req.user?.name || req.body?.deliveryInfo?.emails?.[0] || "guest_b2c";
        console.log(`[Insurance][Book] agentId=${agentId}, agentName=${agentName}`);

        const data = await bookService.book(req.body, agentId, agentName);
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][Book Error]", error?.message || error);
        const status  = error.status || error.response?.status || 500;
        const message = error.message || "Booking failed";
        const details = error.response?.data || null;
        res.status(status).json({ status: false, statusCode: status, message, details });
    }
};
