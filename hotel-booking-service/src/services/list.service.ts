import { BookingStatus } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

class ListService {
  async list(query: {
    status?: string;
    page?: number;
    limit?: number;
    agentId?: any;
    isGuest?: boolean;
    email?: string;
    clientType?: string;
    isAdmin?: boolean;
  }) {
    const filter: any = {};

    if (query.clientType) {
      filter.clientType = query.clientType;
    }

    if (
      query.status &&
      Object.values(BookingStatus).includes(query.status as BookingStatus)
    ) {
      filter.status = query.status;
    }

    if (!query.isAdmin) {
      if (query.clientType === "GUEST") {
        if (query.email) filter.guestEmail = query.email;
      } else if (query.clientType === "B2B") {
        if (query.agentId) filter.agentId = query.agentId;
      } else {
        if (query.agentId) filter.userId = query.agentId;
      }
    }
    console.log(`[FORENSIC] ListService Filter:`, JSON.stringify(filter));

    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      hotelBookingRepository.find(filter, { createdAt: -1 }, skip, limit, true),
      hotelBookingRepository.countDocuments(filter),
    ]);

    // Map to safe DTO to prevent leaking raw provider responses and margins
    const mappedBookings = bookings.map((b: any) => ({
      _id: b._id,
      confirmationNumber: b.confirmationNumber || b.reservationId || "PENDING",
      reservationId: b.reservationId,
      propertyId: b.propertyId || "UNKNOWN",
      provider: b.provider || "rategain",
      status: b.status || "PENDING",
      checkIn: b.checkIn || new Date().toISOString(),
      checkOut: b.checkOut || new Date(Date.now() + 86400000).toISOString(),
      totalAmount: b.totalAmount || 0,
      currencyCode: b.currencyCode || "INR",
      hotelName: b.hotelName || "Hotel",
      hotelImage: b.hotelImage,
      hotelAddress: b.hotelAddress,
      city: b.city,
      starRating: b.starRating,
      agentId: b.agentId,
      guestName: b.guestName || "Guest",
      rooms:
        b.rooms?.map((r: any) => ({
          roomType: r.roomType || r.roomName || "Standard Room",
          boardType: r.boardType || r.boardName,
          guests: r.guests || 1,
          price: r.price || 0,
        })) || [],
      createdAt: b.createdAt,
    }));

    return {
      status: true,
      statusCode: 200,
      body: {
        bookings: mappedBookings,
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
