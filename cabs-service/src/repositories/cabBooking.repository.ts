import { CabBookingModel, CabBookingStatus, PaymentMethod, ICabBooking } from "../models/CabBooking.model";

export class CabBookingRepository {
    /**
     * Generic finder used by the reconciliation worker to sweep stuck bookings.
     */
    async find(filter: Record<string, unknown>): Promise<ICabBooking[]> {
        return await CabBookingModel.find(filter);
    }

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
     * Get bookings for an actor id. B2C/GUEST bookings are stored under `userId`,
     * B2B under `agentId`, so match either to return an agent's or a customer's
     * bookings from the same id.
     */
    async getBookingsByUserId(userId: string): Promise<ICabBooking[]> {
        return await CabBookingModel.find({
            $or: [{ userId }, { agentId: userId }],
        })
            .sort({ createdAt: -1 })
            .lean();
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
     * Delete expired, abandoned bookings by status.
     *
     * Safety guard: never delete a booking that took money or reached the
     * supplier — only truly abandoned drafts (no bookingId, no Razorpay payment,
     * no wallet debit). Otherwise a paid-but-unreconciled booking could be
     * purged, destroying the record, the refund path and the idempotency key.
     */
    async deleteExpiredBookings(status: CabBookingStatus, beforeDate: Date): Promise<number> {
        const filter: Record<string, unknown> = {
            status,
            createdAt: { $lt: beforeDate },
            bookingId: { $in: [null, ""] },
            razorpayPaymentId: { $in: [null, ""] },
            $or: [
                { paymentMethod: { $exists: false } },
                { paymentMethod: PaymentMethod.NONE },
            ],
        };
        const result = await CabBookingModel.deleteMany(filter);
        return result.deletedCount;
    }
}

export const cabBookingRepository = new CabBookingRepository();
