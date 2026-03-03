import { Request, Response, NextFunction } from "express";
import { FlightInstantBookingService } from "../services/flightInstantBookingService";
import { ValidationResult } from "../interface/flight/booking.interface";
import { BookingValidator } from "../utils/booking/bookingValidator";
import { BookingMapper } from "../utils/booking/bookingMapper";

export const createInstantBooking = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userRequest = req.body;

        const validation: ValidationResult = BookingValidator.validate(userRequest);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.errors
            });
        }


        const tripJackRequest = BookingMapper.toTripJackFormat(userRequest);

        const bookingResponse = await FlightInstantBookingService.createInstantBooking(tripJackRequest);

        if (!bookingResponse.status?.success) {
            return res.status(400).json({
                success: false,
                message: "Booking failed",
                errors: bookingResponse.status.errors
            });
        }

        return res.status(200).json({
            success: true,
            message: "Booking created successfully",
            data: {
                bookingId: bookingResponse.bookingId,
                pnr: bookingResponse.order?.pnr,
                ticketNumber: bookingResponse.order?.ticketNumber,
                status: bookingResponse.order?.status
            }
        });

    } catch (error: any) {
        console.error("❌ Error in createInstantBooking:", error);

        if (error.response?.status === 400) {
            return res.status(400).json({
                success: false,
                message: error.response?.data?.message || "Invalid booking request",
                errors: error.response?.data?.errors
            });
        }

        if (error.response?.status === 402) {
            return res.status(402).json({
                success: false,
                message: "Insufficient balance",
                error: error.response?.data
            });
        }

        next(error);
    }
};