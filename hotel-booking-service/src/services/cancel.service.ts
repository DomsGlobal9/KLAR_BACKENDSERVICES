import { rateGainProvider } from "../providers/rategain.provider";
import bookingHistoryService from "./booking-history.service";
import { BookingStatus } from "../../../shared/db/models/Booking.model";

class CancelService {
    async cancel(payload: any, userId: string) {
        try {
            // Call RateGain API to cancel the booking
            const rateGainResponse = await rateGainProvider.cancel(payload);

            // If cancellation was successful, update booking in database
            if (rateGainResponse && rateGainResponse.status) {
                // Find booking by confirmation number and update status
                const booking = await bookingHistoryService.updateBookingStatus(
                    payload.ReservationId,
                    BookingStatus.CANCELLED,
                    userId
                );

                return {
                    ...rateGainResponse,
                    booking: booking ? booking.toJSON() : null
                };
            }

            return rateGainResponse;

        } catch (error: any) {
            // If it's a database error after successful RateGain cancel, log it but don't fail
            if (error.message && !error.message.includes('RateGain')) {
                console.error('Failed to update booking status in database:', error);
            }
            throw error;
        }
    }
}

export const cancelService = new CancelService();
