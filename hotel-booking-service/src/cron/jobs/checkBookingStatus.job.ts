import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { bookingsService } from "../../services/bookings.service";
import { BookingStatus } from "../../models/Booking.model";
import { hotelBookingRepository } from "../../repositories/hotelBooking.repository";

let isRunning = false;

/**
 * Bookings older than this are left to the ReconciliationWorker / ops rather
 * than re-polled forever. Without a bound, a single permanently-stuck record
 * would hit the supplier every 2 minutes for the life of the service.
 */
const MAX_BOOKING_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Cap the work per tick so a backlog can't starve the 2-minute schedule. */
const MAX_BOOKINGS_PER_RUN = 100;

/**
 * Initialize Booking Status Cron
 */
export const checkBookingStatusJob = () => {
  cron.schedule(CRON_TIME.EVERY_2_MINUTES, executeBookingStatusCron);
};

/**
 * Main Cron Executor
 */
const executeBookingStatusCron = async () => {
  /**
   * Prevent overlapping execution
   */
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    /**
     * Get all bookings in a non-terminal state.
     * HELD stays in the sweep: a TripJack hold can still expire or be
     * cancelled upstream, and only the supplier knows when.
     *
     * CONFIRMED bookings whose cached TripJack payload still carries
     * isSystemPending also stay in: the booking was confirmed off a
     * provisional snapshot, and the real hotel/PMS confirmation number only
     * arrives once TripJack finishes downstream processing. The re-sync
     * refreshes the payload (clearing the flag, which drops the booking back
     * out of this sweep) and backfills hotelConfirmationNumber.
     */
    const bookings = await hotelBookingRepository.find(
      {
        $or: [
          {
            status: {
              $nin: [
                BookingStatus.CONFIRMED,
                BookingStatus.CANCELLED,
                BookingStatus.FAILED,
              ],
            },
          },
          {
            status: BookingStatus.CONFIRMED,
            "tripJackResponse.isSystemPending": true,
          },
        ],
        createdAt: { $gt: new Date(Date.now() - MAX_BOOKING_AGE_MS) },
      },
      { createdAt: 1 },
      undefined,
      MAX_BOOKINGS_PER_RUN,
      true,
    );

    /**
     * No bookings found
     */
    if (!bookings.length) {
      return;
    }

    /**
     * Process all bookings
     */
    await processBookings(bookings);
  } catch (error: any) {
    console.error("Booking status cron failed >>>", error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Process All Bookings
 */
const processBookings = async (bookings: any[]) => {
  for (const booking of bookings) {
    await processSingleBooking(booking);
  }
};

/**
 * Process Single Booking
 *
 * syncBookingStatus persists any transition and — unlike the old path through
 * getBookingById — sends the confirmation voucher when a TripJack booking
 * resolves to CONFIRMED after the in-request poll window has closed.
 */
const processSingleBooking = async (booking: any) => {
  try {
    await bookingsService.syncBookingStatus(booking);
  } catch (error: any) {
    console.error(
      `Booking status check failed for ID: ${booking._id}`,
      error.message,
    );
  }
};
