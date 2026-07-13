import { BookingProvider, BookingStatus } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

import { tripJackProvider } from "../providers/tripjack.provider";
import { rateGainProvider } from "../providers/rategain.provider";
import { notificationService } from "./notification.service";
import { refundService } from "./refund.service";

/**
 * Statuses the supplier can no longer move us out of. Once a booking lands
 * here we stop calling the supplier on every read — mirrors the flight
 * service, whose status cron skips SUCCESS/FAILED/CANCELLED/ABORTED.
 */
const TERMINAL_STATUSES: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.CANCELLED,
  BookingStatus.FAILED,
]);
import { refundService } from "./refund.service";

/**
 * Statuses the supplier can no longer move us out of. Once a booking lands
 * here we stop calling the supplier on every read — mirrors the flight
 * service, whose status cron skips SUCCESS/FAILED/CANCELLED/ABORTED.
 */
const TERMINAL_STATUSES: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.CANCELLED,
  BookingStatus.FAILED,
]);

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
   * Pull the live status from the supplier and persist any transition.
   *
   * Shared by the booking-details endpoint and the 2-minute status cron so
   * that a booking resolves the same way no matter who observes it first.
   * Returns the freshest booking document.
   *
   * Transitions are applied conditionally (see `transitionStatus`), so when
   * the in-request poll in commit.service and this method race, exactly one
   * of them owns the transition and sends the confirmation email.
   */
  async syncBookingStatus(booking: any): Promise<any> {
    if (!booking || TERMINAL_STATUSES.has(booking.status)) return booking;

    if (booking.provider === BookingProvider.TRIPJACK) {
      return this.syncTripJackStatus(booking);
    }
    if (booking.provider === BookingProvider.RATEGAIN) {
      return this.syncRateGainStatus(booking);
    }
    return booking;
  }

  /**
   * Side effects that must fire exactly once, when a booking first reaches a
   * terminal state — no matter which caller observed it.
   *
   * All of these are idempotent: the refund is claimed before money moves, so
   * the in-request poll, this sync and the reconciliation worker can all
   * observe the same transition without paying twice.
   */
  private async onStatusResolved(
    booking: any,
    newStatus: BookingStatus,
    reason: string,
  ): Promise<void> {
    if (newStatus === BookingStatus.CONFIRMED) {
      notificationService.sendBookingConfirmation(booking);
      return;
    }

    if (newStatus === BookingStatus.HELD) {
      notificationService.sendBookingStatusEmail(booking, BookingStatus.HELD);
      return;
    }

    if (newStatus === BookingStatus.FAILED) {
      await refundService.refundFailedBooking(
        booking,
        `Supplier did not honour the booking. ${reason}`,
      );
      return;
    }

    if (newStatus === BookingStatus.CANCELLED) {
      // Covers the cancel poll dying mid-flight, and cancellations initiated by
      // the hotel rather than by us. settleCancellation parks the booking for a
      // human when the penalty is unknown instead of guessing an amount.
      await refundService.settleCancellation(booking, booking.cancelChargesInfo);
    }
  }

  private async syncTripJackStatus(booking: any): Promise<any> {
    try {
      const tjDetails = await tripJackProvider.getBookingDetails(
        booking.confirmationNumber,
      );
      if (!tjDetails) return booking;

      const orderStatus = tjDetails?.order?.status;
      const rsta = tjDetails?.itemInfos?.HOTEL?.ops?.[0]?.rsta;

      // TripJack sets isSystemPending while the order is still being placed
      // downstream. Any status it reports alongside that flag is provisional,
      // so we refresh the cached payload but never advance the booking.
      const isSystemPending = tjDetails?.isSystemPending === true;

      let newStatus: BookingStatus = booking.status;
      if (!isSystemPending) {
        if (orderStatus === "SUCCESS" || rsta === "S") {
          newStatus = BookingStatus.CONFIRMED;
        } else if (orderStatus === "ON_HOLD" || rsta === "O") {
          newStatus = BookingStatus.HELD;
        }
      }

      if (
        orderStatus === "CANCELLED" ||
        rsta === "C" ||
        tjDetails?.status?.description?.toLowerCase()?.includes("cancelled")
      ) {
        newStatus = BookingStatus.CANCELLED;
      } else if (orderStatus === "FAILED" || orderStatus === "ABORTED") {
        newStatus = BookingStatus.FAILED;
      }

      const hotelConfirmationNumber = tjDetails?.hotelConfirmationNumber;
      const payloadUpdate: any = { tripJackResponse: tjDetails };
      if (hotelConfirmationNumber) {
        payloadUpdate.hotelConfirmationNumber = hotelConfirmationNumber;
      }

      if (newStatus === booking.status) {
        await hotelBookingRepository.findByIdAndUpdate(
          booking._id,
          payloadUpdate,
        );
        return booking;
      }

      const updated = await hotelBookingRepository.transitionStatus(
        booking._id,
        newStatus,
        payloadUpdate,
      );

      // null => a concurrent worker already moved it to `newStatus`.
      if (!updated) return booking;

      console.log(
        `[TJ Sync] Booking ${booking.confirmationNumber} | ${booking.status} -> ${newStatus}`,
      );

      await this.onStatusResolved(updated, newStatus, `TripJack reported ${orderStatus || rsta}.`);
      return updated;
    } catch (syncErr: any) {
      console.error(
        `[TJ Sync] Failed to sync live status for booking ${booking.confirmationNumber}:`,
        syncErr.message,
      );
      return booking;
    }
  }

  private async syncRateGainStatus(booking: any): Promise<any> {
    try {
      const rgDetails = await rateGainProvider.getReservationDetails(
        booking.confirmationNumber,
        booking.reservationId,
        booking.propertyId,
        booking.brandCode,
      );
      if (!rgDetails) return booking;

      const rgStatus = (
        rgDetails?.body?.booking?.status ||
        rgDetails?.booking?.status ||
        rgDetails?.status ||
        ""
      )
        .toString()
        .trim();

      let newStatus: BookingStatus | null = null;
      if (/^confirmed$/i.test(rgStatus)) {
        newStatus = BookingStatus.CONFIRMED;
      } else if (/^cancelled$/i.test(rgStatus)) {
        newStatus = BookingStatus.CANCELLED;
      } else if (/^(failed|rejected)$/i.test(rgStatus)) {
        newStatus = BookingStatus.FAILED;
      }

      const payloadUpdate: any = { rateGainResponse: rgDetails };
      const freshConfirmation = rgDetails?.body?.booking?.confirmationNumber;
      if (newStatus === BookingStatus.CONFIRMED && freshConfirmation) {
        payloadUpdate.confirmationNumber = freshConfirmation;
      }

      // Still in limbo, or already where we expect it — just refresh the cache.
      if (!newStatus || newStatus === booking.status) {
        await hotelBookingRepository.findByIdAndUpdate(
          booking._id,
          payloadUpdate,
        );
        return booking;
      }

      const updated = await hotelBookingRepository.transitionStatus(
        booking._id,
        newStatus,
        payloadUpdate,
      );
      if (!updated) return booking;

      console.log(
        `[RG Sync] Booking ${booking.confirmationNumber} | ${booking.status} -> ${newStatus} (rgStatus: ${rgStatus})`,
      );

      await this.onStatusResolved(updated, newStatus, `RateGain reported ${rgStatus}.`);
      return updated;
    } catch (rgSyncErr: any) {
      console.error(
        `[RG Sync] Failed to sync live status for booking ${booking.confirmationNumber}:`,
        rgSyncErr.message,
      );
      return booking;
    }
  }

  /**
   * Get a specific booking by confirmation number or reservation ID
   */
  async getBookingById(id: string) {
    try {
      const query: any = {
        $or: [
          { confirmationNumber: id },
          { reservationId: id },
          { publicToken: id },
        ],
      };

      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or.push({ _id: id });
      }

      let booking = await hotelBookingRepository.findOne(query);

      // Sync live status from TripJack on every detail fetch
      if (
        booking &&
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
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                status: newStatus,
                tripJackResponse: tjDetails,
              });
            } else {
              // Update the response payload to keep it fresh without changing status
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
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

      // Sync live status from RateGain on every detail fetch
      if (
        booking &&
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
              const statusChanged = booking.status !== BookingStatus.CONFIRMED;
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                status: BookingStatus.CONFIRMED,
                rateGainResponse: rgDetails,
                ...(rgDetails?.body?.booking?.confirmationNumber
                  ? { confirmationNumber: rgDetails.body.booking.confirmationNumber }
                  : {}),
              });
              if (statusChanged) {
                booking.status = BookingStatus.CONFIRMED;
                notificationService.sendBookingConfirmation(booking);
                console.log(`[RG Sync] Booking ${id} resolved to CONFIRMED`);
              }
            } else if (/^(failed|cancelled|rejected)$/i.test(rgStatus)) {
              const isCancelled = /^cancelled$/i.test(rgStatus);
              const newStatus = isCancelled ? BookingStatus.CANCELLED : BookingStatus.FAILED;
              const statusChanged = booking.status !== newStatus;

              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                status: newStatus,
                rateGainResponse: rgDetails,
              });
              if (statusChanged) {
                booking.status = newStatus;
                console.log(`[RG Sync] Booking ${id} resolved to ${newStatus} (rgStatus: ${rgStatus})`);
              }
            } else {
              // Still in limbo or unchanged — update response payload
              await hotelBookingRepository.findByIdAndUpdate(booking._id, {
                rateGainResponse: rgDetails,
              });
            }
          }
        } catch (rgSyncErr: any) {
          console.error(`[RG Sync] Failed to sync live status for booking ${id}:`, rgSyncErr.message);
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
          userId: booking.userId,
          guestEmail: booking.guestEmail,
          userInfo: booking.userInfo,
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
