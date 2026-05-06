import { Request, Response } from "express";
import BookingService from "../services/booking.service";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import { validateBookingPayload } from "../utils/tripjackBookingVerifier";

class BookingController {

    async instantBook(req: Request, res: Response) {
        try {
            const payload = { ...req.body, isHold: false };

            validateBookingPayload(payload);

            const mapped = mapToTripjackBooking(payload);

            const response = await BookingService.book(mapped);

            return res.status(200).json({
                success: true,
                data: response.data,
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async holdBook(req: Request, res: Response) {
        try {
            const payload = { ...req.body, isHold: true };

            validateBookingPayload(payload);

            const mapped = mapToTripjackBooking(payload);

            const response = await BookingService.book(mapped);

            return res.status(200).json({
                success: true,
                data: response.data,
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async validateFare(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            const response = await BookingService.validateFare(bookingId);

            return res.status(200).json(response.data);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async confirm(req: Request, res: Response) {
        try {
            const { bookingId, amount } = req.body;

            const response = await BookingService.confirmBooking(
                bookingId,
                amount
            );

            return res.status(200).json(response.data);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}

export default new BookingController();