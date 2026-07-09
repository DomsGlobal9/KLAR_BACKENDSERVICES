import { BookingProvider, BookingStatus } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

import { tripJackProvider } from "../providers/tripjack.provider";
import { rateGainProvider } from "../providers/rategain.provider";
import { notificationService } from "./notification.service";


class BookingsService {
  /**
   * Get all bookings from the database filtered by user ID.
   */
  async getAllBookings(agentId?: string) {
    try {
      const query = agentId ? { agentId } : {};
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
      // RateGain MANUAL_REVIEW → poll GetReservation for a live status update.
      // This mirrors the TripJack sync above and resolves the case where RG
      // accepted the booking but couldn't confirm it synchronously.
      if (
        booking &&
        booking.status === BookingStatus.MANUAL_REVIEW &&
        booking.provider === BookingProvider.RATEGAIN
      ) {
        try {
          const rgDetails = await rateGainProvider.getReservationDetails(
            booking.confirmationNumber,
            booking.reservationId,
            booking.propertyId,
            booking.brandCode,
          );

          if (rgDetails) {
            const rgStatus = (
              rgDetails?.body?.booking?.status ||
              rgDetails?.booking?.status ||
              rgDetails?.status ||
              ""
            ).toString().trim();

            if (/^confirmed$/i.test(rgStatus)) {
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                status: BookingStatus.CONFIRMED,
                rateGainResponse: rgDetails,
                ...(rgDetails?.body?.booking?.confirmationNumber
                  ? { confirmationNumber: rgDetails.body.booking.confirmationNumber }
                  : {}),
              });
              booking.status = BookingStatus.CONFIRMED;
              // Fire confirmation email now that we have a real confirmation
              notificationService.sendBookingConfirmation(booking);
              console.log(`[RG Sync] Booking ${id} resolved from MANUAL_REVIEW → CONFIRMED`);
            } else if (/^(failed|cancelled|rejected)$/i.test(rgStatus)) {
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                status: BookingStatus.FAILED,
                rateGainResponse: rgDetails,
              });
              booking.status = BookingStatus.FAILED;
              console.log(`[RG Sync] Booking ${id} resolved from MANUAL_REVIEW → FAILED (rgStatus: ${rgStatus})`);
            } else {
              // Still in limbo — log and leave as MANUAL_REVIEW for next poll
              console.log(`[RG Sync] Booking ${id} still MANUAL_REVIEW (rgStatus: "${rgStatus || 'unknown'}")`);
            }
          }
        } catch (rgSyncErr: any) {
          console.error(`[RG Sync] Failed to sync MANUAL_REVIEW for booking ${id}:`, rgSyncErr.message);
          // Non-fatal: return whatever we have from the DB
        }
      }

      if (booking) {
        return {
          _id: booking._id,
          confirmationNumber: booking.confirmationNumber || booking.reservationId || 'PENDING',
          reservationId: booking.reservationId,
          propertyId: booking.propertyId || 'UNKNOWN',
          provider: booking.provider || 'rategain',
          status: booking.status || 'PENDING',
          checkIn: booking.checkIn || new Date().toISOString(),
          checkOut: booking.checkOut || new Date(Date.now() + 86400000).toISOString(),
          totalAmount: booking.totalAmount || 0,
          currencyCode: booking.currencyCode || 'INR',
          hotelName: booking.hotelName || 'Hotel',
          hotelImage: booking.hotelImage,
          hotelAddress: booking.hotelAddress,
          city: booking.city,
          starRating: booking.starRating,
          agentId: booking.agentId,
          guestName: booking.guestName || 'Guest',
          rooms: booking.rooms?.map((r: any) => ({
            roomType: r.roomType || r.roomName || 'Standard Room',
            boardType: r.boardType || r.boardName,
            guests: r.guests || 1,
            price: r.price || 0,
          })) || [],
          createdAt: booking.createdAt,
        };
      }

      return booking;
    } catch (error: any) {
      console.error("Error fetching booking:", error.message);
      throw error;
    }
  }
}

export const bookingsService = new BookingsService();
