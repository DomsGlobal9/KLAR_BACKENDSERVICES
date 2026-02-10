import mongoose from 'mongoose';
import { rateGainProvider } from "../providers/rategain.provider";
import Booking, { BookingStatus } from "../../../shared/db/models/Booking.model";

class CommitService {
    async commit(payload: any, userId: string) {
        try {
            // Call RateGain API to commit the booking
            const rateGainResponse = await rateGainProvider.commit(payload);

            // Check if RateGain commit was successful
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === 'success')) {
                // Extract booking details from payload and response
                const bookReservation = payload.BookReservation;
                const rategainBody = rateGainResponse.body || {};
                // Attempt to save to database, but don't fail the whole request if DB is missing
                let savedBooking = null;
                try {
                    const rategainBooking = rategainBody.booking || {};
                    // Validate userId: if it's not a valid hex string, set it as undefined
                    // Mongoose expects a valid ObjectId hex string (24 chars) or it will throw a CastError.
                    const validUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : undefined;

                    const booking = new Booking({
                        userId: validUserId,
                        confirmationNumber: rategainBooking.confirmationNumber || rateGainResponse.ConfirmationNumber || bookReservation.EchoToken,
                        propertyId: bookReservation.propertyID,
                        propertyName: bookReservation.PropertyCode,
                        propertyCode: bookReservation.PropertyCode,
                        status: BookingStatus.CONFIRMED,
                        checkIn: new Date(bookReservation.checkin),
                        checkOut: new Date(bookReservation.checkout),
                        totalAmount: bookReservation.BookingRate,
                        currencyCode: bookReservation.CurrencyCode,
                        guests: bookReservation.RoomSelection.flatMap((room: any) =>
                            room.Guest.map((guest: any) => ({
                                firstName: guest.FirstName,
                                lastName: guest.LastName,
                                email: guest.Email,
                                phone: guest.Phone,
                                isPrimary: guest.Primary
                            }))
                        ),
                        rooms: bookReservation.RoomSelection.map((room: any) => ({
                            roomTypeCode: room.RoomTypeCode,
                            numberOfRooms: room.NumberOfRooms,
                            numberOfAdults: room.NumberOfAdults,
                            numberOfChildren: room.NumberOfChild,
                            roomRate: room.RoomRate,
                            boardName: room.BoardName
                        })),
                        rateGainResponse: rateGainResponse.body || rateGainResponse,
                        walletId: payload.BookReservation.walletId,
                        paymentId: payload.BookReservation.paymentId,
                        paymentStatus: payload.BookReservation.paymentId ? 'COMPLETED' : 'PENDING',
                        // Extract special requests and remarks from the first room (assuming single room booking for now)
                        specialRequests: bookReservation.RoomSelection?.[0]?.SpecialRequest ? bookReservation.RoomSelection[0].SpecialRequest.split(',') : [],
                        remarks: bookReservation.RoomSelection?.[0]?.Comment || ''
                    });

                    await booking.save();
                    savedBooking = booking.toJSON();
                } catch (dbError: any) {
                    console.error('DATABASE ERROR (Booking not saved to history):', dbError.message);
                    // We continue because RateGain already confirmed the booking
                }

                return {
                    ...rateGainResponse,
                    booking: savedBooking,
                    dbError: savedBooking ? null : 'Booking confirmed but not saved to local history (No DB)'
                };
            }

            return rateGainResponse;

        } catch (error: any) {
            // If it's a database error after successful RateGain commit, log it but don't fail
            if (error.message && !error.message.includes('RateGain')) {
                console.error('Failed to save booking to database:', error);
            }
            throw error;
        }
    }
}

export const commitService = new CommitService();
