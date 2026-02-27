import { rateGainProvider } from "../providers/rategain.provider";
import { BookingModel, BookingStatus } from "../models/Booking.model";

class CommitService {
    async commit(payload: any) {
        // Direct proxy to RateGain CommitReservation API
        const rateGainResponse = await rateGainProvider.commit(payload);

        // Map and save to DB
        try {
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === 'success')) {
                const bookReservation = (payload && payload.BookReservation) ? payload.BookReservation : {};
                const rategainBooking = rateGainResponse.body?.booking || {};

                // Find primary guest name safely
                const firstRoom = Array.isArray(bookReservation.RoomSelection) ? bookReservation.RoomSelection[0] : null;
                const firstGuest = firstRoom && Array.isArray(firstRoom.Guest) ? firstRoom.Guest[0] : null;
                const guestName = firstGuest ? `${firstGuest.FirstName || ''} ${firstGuest.LastName || ''}`.trim() : 'Unknown';

                let confirmationNumber = rategainBooking.confirmationNumber || rategainBooking.ConfirmationNumber || rateGainResponse.ConfirmationNumber || bookReservation.EchoToken || 'CONF-UNKNOWN';
                let reservationId = rategainBooking.ReservationId || rategainBooking.reservationId || confirmationNumber;

                const bookingRecord = new BookingModel({
                    confirmationNumber,
                    reservationId,
                    propertyId: bookReservation.propertyID || bookReservation.PropertyId,
                    propertyCode: bookReservation.PropertyCode,
                    status: BookingStatus.CONFIRMED,
                    checkIn: bookReservation.checkin ? new Date(bookReservation.checkin) : new Date(),
                    checkOut: bookReservation.checkout ? new Date(bookReservation.checkout) : new Date(Date.now() + 86400000),
                    totalAmount: bookReservation.BookingRate || 0,
                    currencyCode: bookReservation.CurrencyCode || 'USD',
                    guestName: guestName,
                    rooms: Array.isArray(bookReservation.RoomSelection) ? bookReservation.RoomSelection : [],
                    rateGainRequest: payload,
                    rateGainResponse: rateGainResponse
                });

                await bookingRecord.save();
                console.log(`✅ Saved booking to local DB: ${confirmationNumber}`);
            }
        } catch (dbError: any) {
            console.error('⚠️ local DB insert failed (RateGain was successful):', dbError.message);
        }

        return rateGainResponse;
    }
}

export const commitService = new CommitService();
