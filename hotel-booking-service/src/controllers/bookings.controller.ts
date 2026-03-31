import { Request, Response } from "express";
import { bookingsService } from "../services/bookings.service";

export const getBookings = async (_req: Request, res: Response) => {
    try {
        const bookings = await bookingsService.getAllBookings();
        res.json({
            status: true,
            statusCode: 200,
            body: bookings
        });
    } catch (error: any) {
        console.error("Get Bookings Error:", error.message);
        res.status(500).json({
            status: false,
            statusCode: 500,
            description: error.message || "Failed to fetch bookings",
            body: null
        });
    }
};

export const getBookingDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const booking = await bookingsService.getBookingById(id);

        if (!booking) {
            return res.status(404).json({
                status: false,
                statusCode: 404,
                description: "Booking not found",
                body: null
            });
        }

        res.json({
            status: true,
            statusCode: 200,
            body: booking
        });
    } catch (error: any) {
        console.error("Get Booking Details Error:", error.message);
        res.status(500).json({
            status: false,
            statusCode: 500,
            description: error.message || "Failed to fetch booking details",
            body: null
        });
    }
};
