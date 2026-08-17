import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { bookService } from "../services/book.service";

export const bookController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const reqSource = req.body?.source || req.query?.source || req.headers["x-source"];
        const isB2C = Boolean(reqSource && String(reqSource).toUpperCase().includes("B2C"));

        const agentId   = req.user?.userId || req.user?.id || req.user?._id || (isB2C ? "b2c_guest_user" : "guest_user");
        const agentName = req.user?.email || req.user?.user_email || req.user?.userEmail || req.user?.name || req.body?.deliveryInfo?.emails?.[0] || (isB2C ? "guest_b2c" : "guest_user");

        if (!req.body.source) {
            req.body.source = isB2C ? "B2C_PORTAL" : "B2B_PORTAL";
        }

        console.log(`[Insurance][Book] agentId=${agentId}, agentName=${agentName}, source=${req.body.source}`);

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

