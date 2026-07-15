import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { BookingStatus } from "../../models/Booking.model";
import { hotelBookingRepository } from "../../repositories/hotelBooking.repository";

let isRunning = false;

/**
 * A booking still PENDING a day after commit means every status sync failed to
 * resolve it. The customer has already paid and the supplier may well hold a
 * live reservation, so the record is parked for reconciliation — never deleted.
 *
 * HELD is deliberately untouched: it is a live TripJack hold that /confirm can
 * still turn into a booking, and the status cron will move it to
 * CANCELLED/FAILED once the supplier lets the hold lapse.
 */
const STALE_AFTER_HOURS = 24;

export const deleteExpiredPendingBookingsJob = () => {
  cron.schedule(CRON_TIME.EVERY_DAY_1_AM, executeEscalateStaleBookingsCron);
};

/**
 * Main Cron Executor
 */
const executeEscalateStaleBookingsCron = async () => {
  /**
   * Prevent overlapping execution
   */
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const staleBefore = new Date(
      Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000,
    );

    const escalatedCount = await hotelBookingRepository.escalateStaleBookings(
      [BookingStatus.PENDING, BookingStatus.SUPPLIER_PENDING],
      staleBefore,
      BookingStatus.MANUAL_REVIEW,
      `Unresolved by the supplier for over ${STALE_AFTER_HOURS}h — escalated for reconciliation.`,
    );

    console.log(
      `[CRON] Stale hotel bookings escalated to MANUAL_REVIEW: ${escalatedCount}`,
    );
  } catch (error: any) {
    console.error(
      "Escalate stale hotel bookings cron failed >>>",
      error.message,
    );
  } finally {
    isRunning = false;
  }
};
