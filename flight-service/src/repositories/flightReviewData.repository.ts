import { Model } from 'mongoose';
import { BaseRepository } from './base.repository';
import { FlightReviewData, IFlightReview } from '../model/reviewData.model';


export class FlightReviewDataRepository extends BaseRepository<IFlightReview> {
    
    constructor() {
        super(FlightReviewData);
    }

    /**
     * Create a new flight booking record
     */
    async storeReviewData(data: Partial<IFlightReview>): Promise<IFlightReview> {
        try {
            const booking = new FlightReviewData(data);
            return await booking.save();
        } catch (error: any) {
            throw new Error(`Failed to create booking: ${error.message}`);
        }
    }

    /**
     * Get all flight bookings
     */
    async getAllReviewData(
        page: number = 1,
        limit: number = 10,
        filter: any = {}
    ): Promise<{
        bookings: IFlightReview[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            const skip = (page - 1) * limit;

            const [bookings, total] = await Promise.all([
                FlightReviewData.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                FlightReviewData.countDocuments(filter)
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
     * Get booking by MongoDB _id
     */
    async getReviewDataById(id: string): Promise<IFlightReview | null> {
        try {
            return await FlightReviewData.findById(id).lean();
        } catch (error: any) {
            throw new Error(`Failed to get booking by id: ${error.message}`);
        }
    }

    /**
     * Get booking by bookingId from the API response
     */
    async getReviewDataByBookingId(bookingId: string): Promise<IFlightReview | null> {
        try {
            return await FlightReviewData.findOne({
                'data.mappedData.bookingId': bookingId
            }).lean();
        } catch (error: any) {
            throw new Error(`Failed to get booking by bookingId: ${error.message}`);
        }
    }

    /**
     * Get multiple bookings by bookingIds
     */
    async getReviewDataByBookingIds(bookingIds: string[]): Promise<IFlightReview[]> {
        try {
            return await FlightReviewData.find({
                'data.mappedData.bookingId': { $in: bookingIds }
            }).lean();
        } catch (error: any) {
            throw new Error(`Failed to get bookings by bookingIds: ${error.message}`);
        }
    }

    /**
     * Update booking by bookingId
     */
    async updateReviewDataByBookingId(
        bookingId: string,
        data: Partial<IFlightReview>
    ): Promise<IFlightReview | null> {
        try {
            return await FlightReviewData.findOneAndUpdate(
                { 'data.mappedData.bookingId': bookingId },
                { $set: data },
                { new: true, runValidators: true }
            );
        } catch (error: any) {
            throw new Error(`Failed to update booking: ${error.message}`);
        }
    }

    /**
     * Delete booking by bookingId
     */
    async deleteReviewDataBookingId(bookingId: string): Promise<boolean> {
        try {
            const result = await FlightReviewData.findOneAndDelete({
                'data.mappedData.bookingId': bookingId
            });
            return !!result;
        } catch (error: any) {
            throw new Error(`Failed to delete booking: ${error.message}`);
        }
    }

    /**
     * Get bookings by sessionId
     */
    async getReviewDataSessionId(sessionId: string): Promise<IFlightReview[]> {
        try {
            return await FlightReviewData.find({
                'data.sessionId': sessionId
            }).lean();
        } catch (error: any) {
            throw new Error(`Failed to get bookings by sessionId: ${error.message}`);
        }
    }

    /**
     * Get bookings by date range
     */
    async getReviewDataByDateRange(
        startDate: Date,
        endDate: Date
    ): Promise<IFlightReview[]> {
        try {
            return await FlightReviewData.find({
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).lean();
        } catch (error: any) {
            throw new Error(`Failed to get bookings by date range: ${error.message}`);
        }
    }

    /**
     * Get booking by requestId
     */
    async getReviewDataByRequestId(requestId: string): Promise<IFlightReview | null> {
        try {
            return await FlightReviewData.findOne({
                'data.mappedData.searchQuery.requestId': requestId
            }).lean();
        } catch (error: any) {
            throw new Error(`Failed to get booking by requestId: ${error.message}`);
        }
    }
}