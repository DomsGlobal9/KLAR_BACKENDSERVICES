import { CabBookingModel, CabBookingStatus, ICabBooking } from "../models/CabBooking.model";

export class CabBookingRepository {
    /**
     * Create a new cab booking
     */
    async createBooking(bookingData: Partial<ICabBooking>): Promise<ICabBooking> {
        return await CabBookingModel.create(bookingData);
    }

    /**
     * Get booking by bookingId
     */
    async getBookingById(bookingId: string): Promise<ICabBooking | null> {
        return await CabBookingModel.findOne({ bookingId });
    }

    /**
     * Get bookings by userId
     */
    async getBookingsByUserId(userId: string): Promise<ICabBooking[]> {
        return await CabBookingModel.find({ userId }).sort({ createdAt: -1 }).lean();
    }

    /**
     * Get bookings by status
     */
    async getBookingsByStatus(status: CabBookingStatus): Promise<ICabBooking[]> {
        return await CabBookingModel.find({ status });
    }

    /**
     * Update booking status and response
     */
    async updateBookingStatusAndResponse(bookingId: string, newStatus: CabBookingStatus, response: any): Promise<void> {
        await CabBookingModel.updateOne(
            { bookingId },
            { 
                $set: { 
                    status: newStatus,
                    tripJackResponse: response
                } 
            }
        );
    }

    /**
     * Delete expired bookings by status
     */
    async deleteExpiredBookings(status: CabBookingStatus, beforeDate: Date): Promise<number> {
        const result = await CabBookingModel.deleteMany({
            status,
            createdAt: { $lt: beforeDate }
        });
        return result.deletedCount;
    }
}

export const cabBookingRepository = new CabBookingRepository();
