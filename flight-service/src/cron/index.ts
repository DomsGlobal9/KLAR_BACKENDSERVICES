import { cronConfig } from "../config/corn.config";
import { deleteExpiredInitiatedBookingsJob } from "../repositories/deleteExpiredInitiatedBookings.job";
import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";

export const initializeCrons = () => {

    if (!cronConfig.enabled) {
        console.log("Cron jobs are disabled");
        return;
    }

    console.log("Initializing cron jobs...");

    checkBookingStatusJob();

    deleteExpiredInitiatedBookingsJob();

    console.log("Cron jobs initialized");
};