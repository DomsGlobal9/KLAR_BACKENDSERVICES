import cron from "node-cron";
import { CRON_TIME } from "../../config/corn.config";
import bookingService from "../../services/booking.service";
import bookingLocalService from "../../services/bookingLocal.service";
import { BookingRepository } from "../../repositories/bookingLocal.repository";

const bookingRepository = new BookingRepository();

let isRunning = false;

/**
 * Initialize Booking Status Cron
 */
export const checkBookingStatusJob = () => {
    cron.schedule(
        CRON_TIME.EVERY_2_MINUTES,
        executeBookingStatusCron
    );
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
         * Get all active bookings
         */
        const bookings =
            await bookingRepository.getPendingStatusBookings();

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

        // Error handling without console

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
 */
const processSingleBooking = async (booking: any) => {

    try {

        /**
         * Call Tripjack API
         */
        const response =
            await bookingService.getBookingDetails(
                booking.bookingId
            );

        /**
         * Check & update booking status
         */
        await checkAndUpdateBookingStatus(
            booking,
            response
        );

    } catch (error: any) {

        // Error handling without console
    }
};

/**
 * Compare DB status with API status
 * and update if changed
 */
const checkAndUpdateBookingStatus = async (
    booking: any,
    response: any
) => {
    const latestStatus = response?.order?.status;

    if (!latestStatus) {
        return;
    }

    if (latestStatus === booking.status) {
        return;
    }

    await bookingRepository.updateBookingStatus(
        booking.bookingId,
        latestStatus
    );

    if (latestStatus === "SUCCESS") {
        await bookingLocalService.sendBookingEmails(booking.bookingId);
    }

    if (latestStatus === "CANCELLED") {
        await bookingLocalService.sendCancellationEmails(booking.bookingId);
    }
};