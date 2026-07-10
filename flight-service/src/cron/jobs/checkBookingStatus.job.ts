import cron from "node-cron";
import { CRON_TIME } from "../../config/corn.config";
import bookingService from "../../services/booking.service";
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

        console.error(
            "Booking status cron failed >>>",
            error.message
        );

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

        console.error(
            `Booking failed: ${booking.bookingId}`,
            error.message
        );
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

    /**
     * Latest status from Tripjack API
     */
    const latestStatus =
        response?.order?.status;

    /**
     * No status found
     */
    if (!latestStatus) {
        return;
    }

    /**
     * Log DB vs API status
     */
    console.log(`
        BookingId: ${booking.bookingId}
        DB Status : ${booking.status}
        API Status: ${latestStatus}
    `);

    /**
     * Status unchanged
     */
    if (latestStatus === booking.status) {
        return;
    }

    /**
     * Update booking status in DB
     */
    await bookingRepository.updateBookingStatus(
        booking.bookingId,
        latestStatus
    );

    /**
     * Update Log
     */
    console.log(
        `Updated Booking: ${booking.bookingId} | ${booking.status} -> ${latestStatus}`
    );
};