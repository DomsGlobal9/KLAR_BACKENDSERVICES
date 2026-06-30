import { Request, Response, NextFunction } from "express";
import { orderService } from "../services/order.service";

export const getBookingDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bookingIds } = req.query;
        const result = await orderService.getBookingDetails(bookingIds as string);
        console.log("8 order.controller.ts - getBookingDetails - result:", JSON.stringify(result));
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

export const getUserBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.query.userId || req.body?.userId;
        const result = await orderService.getUserBookings(userId as string);
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
