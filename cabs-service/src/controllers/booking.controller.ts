import { Request, Response, NextFunction } from "express";
import { bookingService } from "../services/booking.service";

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await bookingService.book(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const createEmbeddedBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await bookingService.embeddedBook(req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
