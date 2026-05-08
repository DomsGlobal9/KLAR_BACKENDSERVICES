import { cronConfig } from "../config/corn.config";
import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";

export const initializeCrons = () => {

    if (!cronConfig.enabled) {
        console.log("Cron jobs are disabled");
        return;
    }

    console.log("Initializing cron jobs...");

    checkBookingStatusJob();

    console.log("Cron jobs initialized");
};