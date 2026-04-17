import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { bookingDetailsService } from "../services/bookingDetails.service";

export const bookingDetailsController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const bookingId: string = req.body.bookingId || (Array.isArray(req.query.bookingId) ? req.query.bookingId[0] : req.query.bookingId) || "";
        const data = await bookingDetailsService.getDetails(bookingId);
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][BookingDetails Error]", error?.message || error);
        const status  = error.status || error.response?.status || 500;
        const message = error.message || "Failed to fetch booking details";
        const details = error.response?.data || null;
        res.status(status).json({ status: false, statusCode: status, message, details });
    }
};

export const bookingDetailsFromDbController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await bookingDetailsService.getFromDb(String(req.params.id));
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][BookingFromDB Error]", error?.message || error);
        const status  = error.status || error.response?.status || 404;
        const message = error.message || "Booking not found";
        res.status(status).json({ status: false, statusCode: status, message });
    }
};
