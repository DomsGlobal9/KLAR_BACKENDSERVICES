import { BookingProvider, BookingStatus } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

import { tripJackProvider } from "../providers/tripjack.provider";

class BookingsService {
  /**
   * Get all bookings from the database filtered by user ID.
   */
  async getAllBookings(filter: any = {}) {
    try {
      const query = { ...filter };
      const bookings = await hotelBookingRepository.find(query, { createdAt: -1 });

      // Map to safe DTO to prevent leaking raw provider responses and margins
      const mappedBookings = bookings.map((b: any) => ({
        _id: b._id,
        confirmationNumber: b.confirmationNumber || b.reservationId || 'PENDING',
        reservationId: b.reservationId,
        propertyId: b.propertyId || 'UNKNOWN',
        provider: b.provider || 'rategain',
        status: b.status || 'PENDING',
        checkIn: b.checkIn || new Date().toISOString(),
        checkOut: b.checkOut || new Date(Date.now() + 86400000).toISOString(),
        totalAmount: b.totalAmount || 0,
        currencyCode: b.currencyCode || 'INR',
        hotelName: b.hotelName || 'Hotel',
        hotelImage: b.hotelImage,
        hotelAddress: b.hotelAddress,
        city: b.city,
        starRating: b.starRating,
        agentId: b.agentId,
        guestName: b.guestName || 'Guest',
        rooms: b.rooms?.map((r: any) => ({
          roomType: r.roomType || r.roomName || 'Standard Room',
          boardType: r.boardType || r.boardName,
          guests: r.guests || 1,
          price: r.price || 0,
        })) || [],
        createdAt: b.createdAt,
      }));

      return mappedBookings;
    } catch (error: any) {
      console.error("Error fetching bookings:", error.message);
      throw error;
    }
  }

  /**
   * Get a specific booking by confirmation number or reservation ID
   */
  async getBookingById(id: string) {
    try {
      const query: any = {
        $or: [{ confirmationNumber: id }, { reservationId: id }],
      };

      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or.push({ _id: id });
      }

      let booking = await hotelBookingRepository.findOne(query);

      // Sync live status for HELD or PENDING bookings from TripJack
      if (
        booking &&
        (booking.status === BookingStatus.HELD ||
          booking.status === BookingStatus.PENDING) &&
        booking.provider === BookingProvider.TRIPJACK
      ) {
        try {
          const tjDetails = await tripJackProvider.getBookingDetails(
            booking.confirmationNumber,
          );

          if (tjDetails) {
            const orderStatus = tjDetails?.order?.status;
            const rsta = tjDetails?.itemInfos?.HOTEL?.ops?.[0]?.rsta;
            let newStatus: BookingStatus = booking.status;

            if (orderStatus === "SUCCESS" || rsta === "S") {
              newStatus = BookingStatus.CONFIRMED;
            } else if (orderStatus === "ON_HOLD" || rsta === "O") {
              newStatus = BookingStatus.HELD;
            } else if (
              orderStatus === "CANCELLED" ||
              rsta === "C" ||
              tjDetails?.status?.description
                ?.toLowerCase()
                ?.includes("cancelled")
            ) {
              newStatus = BookingStatus.CANCELLED;
            } else if (orderStatus === "FAILED" || orderStatus === "ABORTED") {
              newStatus = BookingStatus.FAILED;
            }

            if (newStatus !== booking.status) {
              booking.status = newStatus;
              // Optionally save the updated response payload
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                status: newStatus,
                tripJackResponse: tjDetails,
              });
            }
          }
        } catch (syncErr: any) {
          console.error(
            `Failed to sync live status for booking ${id}:`,
            syncErr.message,
          );
        }
      }



      return booking;
    } catch (error: any) {
      console.error("Error fetching booking:", error.message);
      throw error;
    }
  }
}

export const bookingsService = new BookingsService();
