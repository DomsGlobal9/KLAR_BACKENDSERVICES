import { InsuranceBookingModel, InsuranceBookingStatus, InsuranceJourneyType } from "../models/InsuranceBooking.model";

class ListService {
    async list(query: {
        status?: string;
        journeyType?: string;
        page?: number;
        limit?: number;
        agentId?: string;
    }) {
        const filter: any = {};

        // ── HARD OWNERSHIP GUARD ────────────────────────────────────────────
        // agentId comes from req.user after JWT validation. If it is missing for
        // any reason (expired token, middleware bypass, bad decode) we must never
        // fall through to a filter-less query that would dump the entire table.
        if (!query.agentId) {
            return {
                status: false,
                statusCode: 401,
                body: { bookings: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
            };
        }

        // Always scope to the authenticated user — this filter is non-optional.
        filter.$or = [
            { agentId: query.agentId },
            { userId:  query.agentId },
        ];

        // Optional narrowing filters (safe — ownership filter already applied above).
        if (query.status && Object.values(InsuranceBookingStatus).includes(query.status as InsuranceBookingStatus)) {
            filter.status = query.status;
        }
        if (query.journeyType && Object.values(InsuranceJourneyType).includes(query.journeyType as InsuranceJourneyType)) {
            filter.journeyType = query.journeyType;
        }


        const page  = Math.max(query.page  || 1,  1);
        const limit = Math.min(Math.max(query.limit || 20, 1), 100);
        const skip  = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            InsuranceBookingModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            InsuranceBookingModel.countDocuments(filter),
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
