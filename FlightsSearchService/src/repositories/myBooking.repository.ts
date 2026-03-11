
import { BookingQueryParams } from '../interface/flight/myBooking.types';
import { FlightBookingModel, IFlightBooking } from '../models/flightBooking.model';


export class BookingRepository {
    
    /**
     * Get booking by MongoDB ID
     */
    async findById(id: string): Promise<IFlightBooking | null> {
        return await FlightBookingModel.findById(id).lean();
    }

    /**
     * Get booking by TripJack booking ID
     */
    async findByBookingId(bookingId: string): Promise<IFlightBooking | null> {
        return await FlightBookingModel.findOne({ bookingId }).lean();
    }

    /**
     * Get all bookings with pagination and filters (descending order)
     */
    async findAllBookings(queryParams: BookingQueryParams): Promise<{
        bookings: IFlightBooking[];
        total: number;
    }> {
        const {
            page = 1,
            limit = 10,
            status,
            startDate,
            endDate,
            userId,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = queryParams;

        const filter: any = {};

        if (status) {
            filter.status = status;
        }

        if (userId) {
            filter.userId = userId;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        const skip = (page - 1) * limit;

        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;


        const [bookings, total] = await Promise.all([
            FlightBookingModel.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            FlightBookingModel.countDocuments(filter)
        ]);

        return { bookings, total };
    }

    /**
     * Get bookings by user ID (descending order)
     */
    async findByUserId(userId: string, page: number = 1, limit: number = 10): Promise<{
        bookings: IFlightBooking[];
        total: number;
    }> {
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            FlightBookingModel.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FlightBookingModel.countDocuments({ userId })
        ]);

        return { bookings, total };
    }

    /**
     * Get recent bookings by user ID
     */
    async findRecentByUserId(userId: string, limit: number = 5): Promise<IFlightBooking[]> {
        return await FlightBookingModel.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get bookings by status
     */
    async findByStatus(status: string, limit: number = 50): Promise<IFlightBooking[]> {
        return await FlightBookingModel.find({ status })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Update booking status
     */
    async updateStatus(id: string, status: string, additionalData?: any): Promise<IFlightBooking | null> {
        const updateData: any = { status };
        
        if (status === 'CONFIRMED') {
            updateData.confirmedAt = new Date();
        } else if (status === 'CANCELLED') {
            updateData.cancelledAt = new Date();
        }

        if (additionalData) {
            Object.assign(updateData, additionalData);
        }

        return await FlightBookingModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).lean();
    }

    /**
     * Get booking statistics for a user
     */
    async getUserBookingStats(userId: string): Promise<any> {
        const stats = await FlightBookingModel.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);

        const totalBookings = await FlightBookingModel.countDocuments({ userId });
        const totalSpent = await FlightBookingModel.aggregate([
            { $match: { userId, status: 'CONFIRMED' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        return {
            byStatus: stats,
            totalBookings,
            totalSpent: totalSpent[0]?.total || 0
        };
    }
}