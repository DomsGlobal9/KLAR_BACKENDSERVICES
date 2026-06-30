import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { bookingsService } from "../../services/bookings.service";
import { BookingStatus, BookingProvider } from "../../models/Booking.model";
import { hotelBookingRepository } from "../../repositories/hotelBooking.repository";

let isRunning = false;

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
     * Get all pending and held bookings
     */
    const bookings = await hotelBookingRepository.find(
      {
        status: { $in: [BookingStatus.PENDING, BookingStatus.HELD] },
        provider: BookingProvider.TRIPJACK,
      },
      null,
      undefined,
      undefined,
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
 * We use the existing getBookingById method which already auto-syncs status
 */
const processSingleBooking = async (booking: any) => {
  try {
    const idToSync =
      booking.confirmationNumber ||
      booking.reservationId ||
      booking._id.toString();

    // This existing method will fetch the booking and auto-sync it from TripJack
    await bookingsService.getBookingById(idToSync);

    console.log(`Successfully checked booking status for: ${idToSync}`);
  } catch (error: any) {
    console.error(
      `Booking status check failed for ID: ${booking._id}`,
      error.message,
    );
  }
};
