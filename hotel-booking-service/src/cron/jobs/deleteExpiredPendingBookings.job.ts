import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { BookingStatus } from "../../models/Booking.model";
import { hotelBookingRepository } from "../../repositories/hotelBooking.repository";

let isRunning = false;

/**
 * Initialize Delete Expired PENDING/HELD Bookings Cron
 */
export const deleteExpiredPendingBookingsJob = () => {
    cron.schedule(
        CRON_TIME.EVERY_DAY_1_AM,
        executeDeleteExpiredBookingsCron
    );
};

/**
 * Main Cron Executor
 */
const executeDeleteExpiredBookingsCron = async () => {
    /**
     * Prevent overlapping execution
     */
    if (isRunning) {
        return;
    }

    isRunning = true;

    try {
        /**
         * Delete PENDING and HELD bookings older than 24 hours
         */
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const deletedCount = await hotelBookingRepository.deleteExpiredBookings(
            [BookingStatus.PENDING, BookingStatus.HELD], 
            twentyFourHoursAgo
        );

        console.log(
            `[CRON] Expired PENDING hotel bookings deleted: ${deletedCount}`
        );

    } catch (error: any) {
        console.error(
            "Delete expired hotel bookings cron failed >>>",
            error.message
        );
    } finally {
        isRunning = false;
    }
};
