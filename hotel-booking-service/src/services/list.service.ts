import { BookingModel, BookingStatus } from "../models/Booking.model";

class ListService {
    async list(query: { status?: string; page?: number; limit?: number }) {
        const filter: any = {};

        if (query.status && Object.values(BookingStatus).includes(query.status as BookingStatus)) {
            filter.status = query.status;
        }

        const page = Math.max(query.page || 1, 1);
        const limit = Math.min(Math.max(query.limit || 20, 1), 100);
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            BookingModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BookingModel.countDocuments(filter),
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
