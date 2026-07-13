import { json } from 'zod';
import { IFlightReview } from '../model/reviewData.model';
import { FlightReviewDataRepository } from '../repositories/flightReviewData.repository';

export class FlightReviewDataService {
    private repository: FlightReviewDataRepository;

    constructor() {
        this.repository = new FlightReviewDataRepository();
    }

    /**
     * Create a new flight booking record
     */
    async storeReviewData(data: Partial<IFlightReview>): Promise<IFlightReview> {
        try {

            const bookingId = data?.mappedData?.bookingId;
            if (bookingId) {
                const existingBooking = await this.repository.getReviewDataByBookingId(bookingId);
                if (existingBooking) {
                    throw new Error(`Review data with booking ID ${bookingId} already exists`);
                }
            }

            return await this.repository.storeReviewData(data);
        } catch (error: any) {
            throw new Error(`Service error - storeReviewData: ${error.message}`);
        }
    }

    /**
     * Create or update review data (upsert)
     */
    async upsertReviewData(data: Partial<IFlightReview>): Promise<IFlightReview> {
        try {
            const bookingId = data?.mappedData?.bookingId;
            if (!bookingId) {
                throw new Error('Booking ID is required for upsert');
            }

            const existingBooking = await this.repository.getReviewDataByBookingId(bookingId);

            if (existingBooking) {
                // Update existing review data
                const updated = await this.repository.updateReviewDataByBookingId(bookingId, data);
                if (!updated) {
                    throw new Error(`Failed to update review data for booking ${bookingId}`);
                }
                return updated;
            } else {
                // Create new review data
                return await this.repository.storeReviewData(data);
            }
        } catch (error: any) {
            throw new Error(`Service error - upsertReviewData: ${error.message}`);
        }
    }

    /**
     * Get all flight review data with pagination
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
            return await this.repository.getAllReviewData(page, limit, filter);
        } catch (error: any) {
            throw new Error(`Service error - getAllReviewData: ${error.message}`);
        }
    }

    /**
     * Get review data by MongoDB _id
     */
    async getReviewDataById(id: string): Promise<IFlightReview | null> {
        try {
            const reviewData = await this.repository.getReviewDataById(id);
            if (!reviewData) {
                throw new Error(`Review data with ID ${id} not found`);
            }
            return reviewData;
        } catch (error: any) {
            throw new Error(`Service error - getReviewDataById: ${error.message}`);
        }
    }

    /**
     * Get review data by bookingId
     */
    async getReviewDataByBookingId(bookingId: string): Promise<IFlightReview | null> {
        try {
            const reviewData = await this.repository.getReviewDataByBookingId(bookingId);
            if (!reviewData) {
                throw new Error(`Review data with bookingId ${bookingId} not found`);
            }
            return reviewData;
        } catch (error: any) {
            throw new Error(`Service error - getReviewDataByBookingId: ${error.message}`);
        }
    }

    /**
     * Get multiple review data by bookingIds
     */
    async getReviewDataByBookingIds(bookingIds: string[]): Promise<IFlightReview[]> {
        try {
            return await this.repository.getReviewDataByBookingIds(bookingIds);
        } catch (error: any) {
            throw new Error(`Service error - getReviewDataByBookingIds: ${error.message}`);
        }
    }

    /**
     * Get review data by requestId
     */
    async getReviewDataByRequestId(requestId: string): Promise<IFlightReview | null> {
        try {
            const reviewData = await this.repository.getReviewDataByRequestId(requestId);
            if (!reviewData) {
                throw new Error(`Review data with requestId ${requestId} not found`);
            }
            return reviewData;
        } catch (error: any) {
            throw new Error(`Service error - getReviewDataByRequestId: ${error.message}`);
        }
    }

    /**
     * Get review data by sessionId
     */
    async getReviewDataBySessionId(sessionId: string): Promise<IFlightReview[]> {
        try {
            return await this.repository.getReviewDataSessionId(sessionId);
        } catch (error: any) {
            throw new Error(`Service error - getReviewDataBySessionId: ${error.message}`);
        }
    }

    /**
     * Update review data by bookingId
     */
    async updateReviewDataByBookingId(
        bookingId: string,
        data: Partial<IFlightReview>
    ): Promise<IFlightReview | null> {
        try {
            const updated = await this.repository.updateReviewDataByBookingId(bookingId, data);
            if (!updated) {
                throw new Error(`Review data with bookingId ${bookingId} not found`);
            }
            return updated;
        } catch (error: any) {
            throw new Error(`Service error - updateReviewDataByBookingId: ${error.message}`);
        }
    }

    /**
     * Delete review data by bookingId
     */
    async deleteReviewDataByBookingId(bookingId: string): Promise<boolean> {
        try {
            const deleted = await this.repository.deleteReviewDataBookingId(bookingId);
            if (!deleted) {
                throw new Error(`Review data with bookingId ${bookingId} not found`);
            }
            return deleted;
        } catch (error: any) {
            throw new Error(`Service error - deleteReviewDataByBookingId: ${error.message}`);
        }
    }

    /**
     * Get review data by date range
     */
    async getReviewDataByDateRange(startDate: Date, endDate: Date): Promise<IFlightReview[]> {
        try {
            return await this.repository.getReviewDataByDateRange(startDate, endDate);
        } catch (error: any) {
            throw new Error(`Service error - getReviewDataByDateRange: ${error.message}`);
        }
    }
}