import { rateGainProvider } from "../providers/rategain.provider";
import { BookingModel, BookingStatus } from "../models/Booking.model";

class CancelService {
    async cancel(payload: any) {
        // Direct proxy to RateGain CancelReservation API
        const rateGainResponse = await rateGainProvider.cancel(payload);

        try {
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === 'success')) {
                // RateGain usually requires ReservationId and/or ConfirmationNumber to cancel
                const confirmationNumber = payload.ConfirmationNumber;
                const reservationId = payload.ReservationId;

                if (confirmationNumber || reservationId) {
                    const query: any = {};
                    if (confirmationNumber) query.confirmationNumber = confirmationNumber;
                    if (reservationId) query.reservationId = reservationId;

                    const updated = await BookingModel.findOneAndUpdate(
                        query,
                        { status: BookingStatus.CANCELLED },
                        { new: true }
                    );

                    if (updated) {
                        console.log(`✅ Updated local DB booking to CANCELLED: ${updated.confirmationNumber}`);
                    }
                }
            }
        } catch (dbError: any) {
            console.error('⚠️ local DB update failed (RateGain cancel was successful):', dbError.message);
        }

        return rateGainResponse;
    }
}

export const cancelService = new CancelService();
