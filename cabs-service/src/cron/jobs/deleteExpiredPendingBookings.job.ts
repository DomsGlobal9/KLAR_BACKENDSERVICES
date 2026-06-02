import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { CabBookingModel, CabBookingStatus } from "../../models/CabBooking.model";

let isRunning = false;

/**
 * Initialize Delete Expired PENDING Bookings Cron
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
         * Delete PENDING bookings older than 24 hours
         */
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const result = await CabBookingModel.deleteMany({
            status: CabBookingStatus.PENDING,
            createdAt: { $lt: twentyFourHoursAgo }
        });

        console.log(
            `[Cabs] Expired PENDING cab bookings deleted: ${result.deletedCount}`
        );

    } catch (error: any) {
        console.error(
            "[Cabs] Delete expired cab bookings cron failed >>>",
            error.message
        );
    } finally {
        isRunning = false;
    }
};
