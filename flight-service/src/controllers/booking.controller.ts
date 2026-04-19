import { Request, Response } from "express";
import BookingService from "../services/booking.service";
import { SimpleFrontendBookingPayload } from "../types/flightBook.types";


class BookingController {

    async bookFlight(req: Request, res: Response) {
        try {
            const frontendPayload: SimpleFrontendBookingPayload = req.body;
            const isInstantBook = req.query.instant === "true" || req.body.isInstantBook === true;

            const result = await BookingService.bookFlight(frontendPayload, isInstantBook);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            res.status(error.status || 500).json({
                success: false,
                message: error.message || "Booking failed",
                errors: error.errors || error.response?.data || error,
            });
        }
    }

    async confirmHoldBooking(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            const result = await BookingService.confirmHoldBooking(bookingId);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || "Confirm Hold Booking failed",
                error: error.response?.data || error,
            });
        }
    }

    async confirmFareBeforeTicketing(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            const result = await BookingService.confirmFareBeforeTicketing(bookingId);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || "Fare validation failed",
                error: error.response?.data || error,
            });
        }
    }
}

export default new BookingController();