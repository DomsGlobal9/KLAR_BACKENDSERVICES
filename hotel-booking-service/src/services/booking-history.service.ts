import Booking, { IBooking, BookingStatus } from '../../../shared/db/models/Booking.model';
import { AuthUser } from '../../../shared/auth/auth.service';

export class BookingHistoryService {
    /**
     * Get all bookings for a user with pagination
     */
    public async getBookingsByUser(
        userId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ bookings: IBooking[]; total: number; page: number; totalPages: number }> {
        try {
            const skip = (page - 1) * limit;

            const [bookings, total] = await Promise.all([
                Booking.find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('userId', 'firstName lastName email'),
                Booking.countDocuments({ userId })
            ]);

            return {
                bookings,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error: any) {
            throw new Error(`Failed to get bookings: ${error.message}`);
        }
    }

    /**
     * Get specific booking by ID with authorization check
     */
    public async getBookingById(bookingId: string, userId: string): Promise<IBooking | null> {
        try {
            const booking = await Booking.findOne({
                _id: bookingId,
                userId
            }).populate('userId', 'firstName lastName email');

            return booking;
        } catch (error: any) {
            throw new Error(`Failed to get booking: ${error.message}`);
        }
    }

    /**
     * Get booking by confirmation number
     */
    public async getBookingByConfirmation(
        confirmationNumber: string,
        userId: string
    ): Promise<IBooking | null> {
        try {
            const booking = await Booking.findOne({
                confirmationNumber,
                userId
            }).populate('userId', 'firstName lastName email');

            return booking;
        } catch (error: any) {
            throw new Error(`Failed to get booking: ${error.message}`);
        }
    }

    /**
     * Update booking status
     */
    public async updateBookingStatus(
        bookingId: string,
        status: BookingStatus,
        userId?: string
    ): Promise<IBooking | null> {
        try {
            const query: any = { _id: bookingId };
            if (userId) {
                query.userId = userId;
            }

            const updateData: any = { status };
            if (status === BookingStatus.CANCELLED) {
                updateData.cancelledAt = new Date();
            }

            const booking = await Booking.findOneAndUpdate(
                query,
                updateData,
                { new: true }
            );

            return booking;
        } catch (error: any) {
            throw new Error(`Failed to update booking status: ${error.message}`);
        }
    }

    /**
     * Get booking statistics for a user
     */
    public async getBookingStats(userId: string): Promise<{
        total: number;
        confirmed: number;
        cancelled: number;
        pending: number;
    }> {
        try {
            const [total, confirmed, cancelled, pending] = await Promise.all([
                Booking.countDocuments({ userId }),
                Booking.countDocuments({ userId, status: BookingStatus.CONFIRMED }),
                Booking.countDocuments({ userId, status: BookingStatus.CANCELLED }),
                Booking.countDocuments({ userId, status: BookingStatus.PENDING })
            ]);

            return { total, confirmed, cancelled, pending };
        } catch (error: any) {
            throw new Error(`Failed to get booking stats: ${error.message}`);
        }
    }
}

export default new BookingHistoryService();
