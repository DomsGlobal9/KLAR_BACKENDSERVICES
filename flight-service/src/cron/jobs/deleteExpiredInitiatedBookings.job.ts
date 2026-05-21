import cron from "node-cron";
import { CRON_TIME } from "../../config/corn.config";
import { BookingRepository } from "../../repositories/bookingLocal.repository";

const bookingRepository = new BookingRepository();

let isRunning = false;

/**
 * Initialize Delete Expired INITIATED Bookings Cron
 */
export const deleteExpiredInitiatedBookingsJob = () => {

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
         * Delete expired INITIATED bookings
         */
        const deletedCount =
            await bookingRepository.deleteExpiredInitiatedBookings();

        console.log(
            `Expired INITIATED bookings deleted: ${deletedCount}`
        );

    } catch (error: any) {

        console.error(
            "Delete expired bookings cron failed >>>",
            error.message
        );

    } finally {

        isRunning = false;
    }
};