import { Request, Response, NextFunction } from "express";
import { bookingService } from "../services/booking.service";

export const createBooking = async (req: Request | any, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? authHeader.split(" ")[1] : "";
        const result = await bookingService.book(req.body, token, req.user);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

