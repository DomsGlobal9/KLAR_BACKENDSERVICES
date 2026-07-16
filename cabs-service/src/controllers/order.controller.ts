import { Request, Response, NextFunction } from "express";
import { orderService } from "../services/order.service";
import { resolveCaller } from "../utils/ownership.util";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { StructuredError } from "../services/StructuredError";

export const getBookingDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { bookingIds } = req.query;
        const caller = resolveCaller(req);
        const result = await orderService.getBookingDetails(bookingIds as string, caller);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await orderService.createPayment(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getUserBookings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // IDOR fix: the id comes from the verified token, NOT the query string.
        // Only an admin may look up someone else's bookings via ?userId=.
        const caller = resolveCaller(req);
        const requestedId = (req.query.userId || req.body?.userId) as string | undefined;
        const userId = caller.isAdmin && requestedId ? requestedId : caller.id;
        if (!userId) {
            throw new StructuredError("UNAUTHORIZED", "Authentication required.");
        }
        const result = await orderService.getUserBookings(userId);
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const checkEmailBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.params;
        if (!email) {
            throw new StructuredError("VALIDATION_ERROR", "Email is required");
        }
        const hasBookings = await orderService.checkEmailBookings(email as string);
        res.status(200).json({
            success: true,
            body: { hasBookings }
        });
    } catch (error) {
        next(error);
    }
};
