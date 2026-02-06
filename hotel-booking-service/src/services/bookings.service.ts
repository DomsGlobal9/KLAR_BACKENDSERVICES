import Booking, { IBooking, BookingStatus } from '../../../shared/db/models/Booking.model';

export class BookingsService {
    /**
     * Create a new booking directly in the database
     */
    public async createBooking(data: any, userId: string): Promise<IBooking> {
        try {
            // Generate a temporary confirmation number if not provided
            const confirmationNumber = data.confirmationNumber || `LOC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

            const booking = new Booking({
                userId,
                confirmationNumber,
                propertyId: data.propertyId,
                propertyName: data.propertyName,
                propertyCode: data.propertyCode,
                status: data.status || BookingStatus.PENDING,
                checkIn: new Date(data.checkIn),
                checkOut: new Date(data.checkOut),
                totalAmount: data.totalAmount,
                currencyCode: data.currencyCode || 'USD',
                guests: data.guests,
                rooms: data.rooms,
                rateGainResponse: data.rateGainResponse || {},
                walletId: data.walletId,
                paymentId: data.paymentId,
                paymentStatus: data.paymentStatus || 'PENDING'
            });

            await booking.save();
            return booking;
        } catch (error: any) {
            throw new Error(`Failed to create booking: ${error.message}`);
        }
    }
}

export default new BookingsService();
