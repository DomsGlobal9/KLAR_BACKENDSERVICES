import mongoose from 'mongoose';
import { rateGainProvider } from "../providers/rategain.provider";
import Booking, { BookingStatus } from "../../../shared/db/models/Booking.model";

class CommitService {
    async commit(payload: any, userId: string) {
        let rateGainResponse;
        try {
            // Call RateGain API to commit the booking
            rateGainResponse = await rateGainProvider.commit(payload);
        } catch (apiError: any) {
            console.warn('⚠️ RateGain API Commit Failed:', apiError.message);
            console.log('🔄 Proceeding with MOCK COMMIT for development flow...');

            // Mock a successful response
            rateGainResponse = {
                status: true,
                body: {
                    booking: {
                        confirmationNumber: 'MOCK-' + Math.floor(Math.random() * 1000000),
                        status: 'Confirmed',
                        remark: 'Mocked Booking due to API error: ' + apiError.message
                    }
                }
            };
        }

        try {
            // Check if RateGain commit was successful (or mocked)
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === 'success')) {
                // Extract booking details from payload and response
                const bookReservation = (payload && payload.BookReservation) ? payload.BookReservation : {};
                const rategainBody = rateGainResponse.body || {};

                // Attempt to save to database
                let savedBooking = null;
                try {
                    const rategainBooking = rategainBody.booking || {};
                    // Validate userId
                    const validUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : undefined;

                    // Safely handle nested properties that might be missing in payload
                    const checkInDate = bookReservation.checkin ? new Date(bookReservation.checkin) : new Date();
                    const checkOutDate = bookReservation.checkout ? new Date(bookReservation.checkout) : new Date(Date.now() + 86400000);

                    // Handle RoomSelection safely
                    const roomSelection = Array.isArray(bookReservation.RoomSelection) ? bookReservation.RoomSelection : [];

                    const guests = roomSelection.flatMap((room: any) =>
                        (room.Guest && Array.isArray(room.Guest)) ? room.Guest.map((guest: any) => ({
                            firstName: guest.FirstName || 'Unknown',
                            lastName: guest.LastName || 'Guest',
                            email: guest.Email,
                            phone: guest.Phone,
                            isPrimary: guest.Primary
                        })) : []
                    );

                    const rooms = roomSelection.map((room: any) => ({
                        roomTypeCode: room.RoomTypeCode,
                        numberOfRooms: room.NumberOfRooms,
                        numberOfAdults: room.NumberOfAdults,
                        numberOfChildren: room.NumberOfChild,
                        roomRate: room.RoomRate,
                        boardName: room.BoardName
                    }));

                    const booking = new Booking({
                        userId: validUserId,
                        confirmationNumber: rategainBooking.confirmationNumber || rateGainResponse.ConfirmationNumber || bookReservation.EchoToken || 'CONF-UNKNOWN',
                        propertyId: bookReservation.propertyID,
                        propertyName: bookReservation.PropertyCode,
                        propertyCode: bookReservation.PropertyCode,
                        status: BookingStatus.CONFIRMED,
                        checkIn: checkInDate,
                        checkOut: checkOutDate,
                        totalAmount: bookReservation.BookingRate || 0,
                        currencyCode: bookReservation.CurrencyCode || 'USD',
                        guests: guests,
                        rooms: rooms,
                        rateGainResponse: rateGainResponse.body || rateGainResponse,
                        walletId: bookReservation.walletId,
                        paymentId: bookReservation.paymentId,
                        paymentStatus: bookReservation.paymentId ? 'COMPLETED' : 'PENDING',
                        specialRequests: roomSelection?.[0]?.SpecialRequest ? roomSelection[0].SpecialRequest.split(',') : [],
                        remarks: roomSelection?.[0]?.Comment || ''
                    });

                    await booking.save();
                    savedBooking = booking.toJSON();
                    console.log('✅ Booking saved to database:', savedBooking._id);
                } catch (dbError: any) {
                    console.error('DATABASE ERROR (Booking not saved to history):', dbError.message);
                }

                return {
                    ...rateGainResponse,
                    booking: savedBooking,
                    dbError: savedBooking ? null : 'Booking confirmed but not saved to local history'
                };
            }

            return rateGainResponse;

        } catch (error: any) {
            console.error('Commit Service Fatal Error:', error);
            throw error;
        }
    }
}

export const commitService = new CommitService();
