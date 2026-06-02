import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { BookingModel, BookingStatus } from "../../models/Booking.model";

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

        const result = await BookingModel.deleteMany({
            status: { $in: [BookingStatus.PENDING, BookingStatus.HELD] },
            createdAt: { $lt: twentyFourHoursAgo }
        });

        console.log(
            `Expired PENDING/HELD hotel bookings deleted: ${result.deletedCount}`
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
