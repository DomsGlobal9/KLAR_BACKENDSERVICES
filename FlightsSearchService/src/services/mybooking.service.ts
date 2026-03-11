import { BookingQueryParams } from '../interface/flight/myBooking.types';
import { IFlightBooking } from '../models/flightBooking.model';
import { BookingRepository } from '../repositories/myBooking.repository';

export class BookingService {
    private bookingRepository: BookingRepository;

    constructor() {
        this.bookingRepository = new BookingRepository();
    }

    /**
     * Get booking by MongoDB ID
     */
    async getBookingById(id: string): Promise<IFlightBooking | null> {
        try {
            const booking = await this.bookingRepository.findById(id);
            if (!booking) {
                throw new Error('Booking not found');
            }
            return booking;
        } catch (error) {
            console.error('Error in getBookingById service:', error);
            throw error;
        }
    }

    /**
     * Get booking by TripJack booking ID
     */
    async getBookingByBookingId(bookingId: string): Promise<IFlightBooking | null> {
        try {
            const booking = await this.bookingRepository.findByBookingId(bookingId);
            if (!booking) {
                throw new Error('Booking not found');
            }
            return booking;
        } catch (error) {
            console.error('Error in getBookingByBookingId service:', error);
            throw error;
        }
    }

    /**
     * Get all bookings with pagination and filters (descending order)
     */
    async getAllBookings(queryParams: BookingQueryParams, requestingUserId?: string): Promise<{
        bookings: IFlightBooking[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalItems: number;
            itemsPerPage: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
    }> {
        try {
            const page = Number(queryParams.page) || 1;
            const limit = Number(queryParams.limit) || 10;

            // If userId is provided in query, filter by that user
            // Otherwise, if requestingUserId is provided (non-admin), filter by that user
            const finalQueryParams = {
                ...queryParams,
                page,
                limit,
                userId: queryParams.userId || requestingUserId
            };

            const { bookings, total } = await this.bookingRepository.findAllBookings(finalQueryParams);

            const totalPages = Math.ceil(total / limit);

            return {
                bookings,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            console.error('Error in getAllBookings service:', error);
            throw error;
        }
    }

    /**
     * Get user's bookings with pagination
     */
    async getUserBookings(userId: string, page: number = 1, limit: number = 10): Promise<{
        data: IFlightBooking[];
        total: number;
    }> {
        try {
            const result = await this.bookingRepository.findByUserId(userId, page, limit);
            return {
                data: result.bookings,
                total: result.total
            };
        } catch (error) {
            console.error('Error in getUserBookings service:', error);
            throw error;
        }
    }

    /**
     * Get recent bookings for a user
     */
    async getUserRecentBookings(userId: string, limit: number = 5): Promise<IFlightBooking[]> {
        try {
            return await this.bookingRepository.findRecentByUserId(userId, limit);
        } catch (error) {
            console.error('Error in getUserRecentBookings service:', error);
            throw error;
        }
    }

    /**
     * Get bookings by status
     */
    async getBookingsByStatus(status: string, limit: number = 50): Promise<IFlightBooking[]> {
        try {
            return await this.bookingRepository.findByStatus(status, limit);
        } catch (error) {
            console.error('Error in getBookingsByStatus service:', error);
            throw error;
        }
    }

    /**
     * Update booking status
     */
    async updateBookingStatus(id: string, statusData: { status: string; failureReason?: string }): Promise<IFlightBooking | null> {
        try {
            const booking = await this.bookingRepository.updateStatus(id, statusData.status, {
                failureReason: statusData.failureReason
            });
            if (!booking) {
                throw new Error('Booking not found');
            }
            return booking;
        } catch (error) {
            console.error('Error in updateBookingStatus service:', error);
            throw error;
        }
    }

    /**
     * Get booking statistics for a user
     */
    async getBookingStats(userId: string): Promise<any> {
        try {
            return await this.bookingRepository.getUserBookingStats(userId);
        } catch (error) {
            console.error('Error in getBookingStats service:', error);
            throw error;
        }
    }
}