import { Request, Response } from "express";
import { TripJackApiProvider } from "../providers/tripjack.api.provider";
import { BookingModel, BookingStatus } from "../models/Booking.model";

/**
 * Controller to confirm a previously HELD booking.
 * POST /confirm
 */
export const confirmController = async (req: Request, res: Response) => {
    try {
        const bookingId = req.body.bookingId;
        const booking = await BookingModel.findOne({
            $or: [{ confirmationNumber: bookingId }, { reservationId: bookingId }]
        });

        if (!booking) {
            return res.status(404).json({ status: false, description: "Booking not found" });
        }

        const provider = new TripJackApiProvider();
        
        // 1. Fetch the exact upstream order details to get the PERFECT amount match
        const tjDetails = await provider.getBookingDetails(bookingId);
        if (!tjDetails || !tjDetails.order || typeof tjDetails.order.amount === 'undefined') {
            return res.status(500).json({ status: false, description: "Could not fetch upstream booking details to verify payment amount." });
        }

        const exactAmount = tjDetails.order.amount;
        console.log(`[ConfirmController] Fetched exact order amount from TripJack: ${exactAmount}`);

        // 2. Confirm the booking with the exact upstream amount
        const result = await provider.confirmBook({
            bookingId: bookingId,
            paymentInfos: [{ amount: exactAmount }]
        });

        if (result?.status?.success === true || result?.status === true || result?.order?.status === "CONFIRMED") {
            booking.status = BookingStatus.CONFIRMED;
            booking.tripJackResponse = result;
            await booking.save();
        }
        
        res.status(200).json({
            status: true,
            statusCode: 200,
            description: "TripJack Confirmation Success",
            body: result
        });
    } catch (error: any) {
        console.error("[ConfirmController] Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message,
            body: error.response?.data
        });
    }
};
