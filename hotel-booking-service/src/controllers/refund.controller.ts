import { Request, Response } from "express";
import { refundService } from "../services/refund.service";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { BookingStatus, RefundStatus } from "../models/Booking.model";

/**
 * Controller to manually trigger a refund for an already cancelled booking.
 * Used by the CRM when ENABLE_AUTO_REFUNDS=false is set.
 */
export const processManualRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    
    if (!bookingId) {
      res.status(400).json({ status: false, message: "bookingId parameter is required" });
      return;
    }

    const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(bookingId));
    const query: any = isObjectId
      ? { _id: bookingId }
      : {
          $or: [
            { confirmationNumber: bookingId },
            { reservationId: bookingId },
          ],
        };

    const booking = await hotelBookingRepository.findOne(query);

    if (!booking) {
      res.status(404).json({ status: false, message: "Booking not found" });
      return;
    }

    if (booking.status !== BookingStatus.CANCELLED && booking.status !== BookingStatus.CANCELLATION_PENDING) {
      res.status(400).json({ 
        status: false, 
        message: `Only cancelled bookings can be manually refunded. Current status: ${booking.status}` 
      });
      return;
    }

    if (booking.refundData?.status === RefundStatus.COMPLETED) {
      res.status(400).json({ status: false, message: "Refund has already been processed for this booking." });
      return;
    }

    const cancelChargesInfo = booking.cancelChargesInfo || {
       totalAmount: booking.totalAmount,
       applicableCharge: booking.cancelCharge || 0,
       refundAmount: Math.max(0, (booking.totalAmount || 0) - (booking.cancelCharge || 0))
    };

    console.log(`[Manual Refund] Processing manual CRM refund for booking: ${booking.confirmationNumber}`);
    
    // This will calculate exact penalty, initiate Razorpay/Wallet refund, and mark status as CANCELLED
    await refundService.settleCancellation(booking, cancelChargesInfo);

    res.json({ 
      status: true, 
      message: "Refund successfully initiated.",
      refundAmount: cancelChargesInfo.refundAmount
    });
  } catch (error: any) {
    console.error("[Manual Refund] Error:", error.message);
    res.status(500).json({ status: false, message: error.message });
  }
};
