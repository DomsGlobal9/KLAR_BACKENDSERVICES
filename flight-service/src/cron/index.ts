import { cronConfig } from "../config/corn.config";
import { deleteExpiredInitiatedBookingsJob } from "./jobs/deleteExpiredInitiatedBookings.job";
import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";
import { calculateCancellationRefundJob } from "./jobs/calculateCancellationRefund.job";

export const initializeCrons = () => {

    if (!cronConfig.enabled) {
        console.log("Cron jobs are disabled");
        return;
    }

    console.log("Initializing cron jobs...");

    checkBookingStatusJob();

    deleteExpiredInitiatedBookingsJob();

    // calculateCancellationRefundJob();

    console.log("Cron jobs initialized");
};