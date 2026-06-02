import { BookingStatus } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

class ListService {
    async list(query: { status?: string; page?: number; limit?: number; agentId?: any }) {
        const filter: any = {};

        if (query.status && Object.values(BookingStatus).includes(query.status as BookingStatus)) {
            filter.status = query.status;
        }

        if (query.agentId) {
            filter.$or = [
                { agentId: query.agentId },
                { userId: query.agentId } // Support filtering by userId as well
            ];
        }
        console.log(`[FORENSIC] ListService Filter:`, JSON.stringify(filter));

        const page = Math.max(query.page || 1, 1);
        const limit = Math.min(Math.max(query.limit || 20, 1), 100);
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            hotelBookingRepository.find(filter, { createdAt: -1 }, skip, limit, true),
            hotelBookingRepository.countDocuments(filter),
        ]);

        return {
            status: true,
            statusCode: 200,
            body: {
                bookings,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        };
    }
}

export const listService = new ListService();
