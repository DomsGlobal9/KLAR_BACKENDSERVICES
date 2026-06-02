import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";
import { deleteExpiredPendingBookingsJob } from "./jobs/deleteExpiredPendingBookings.job";

export const initializeCronJobs = () => {
    checkBookingStatusJob();
    deleteExpiredPendingBookingsJob();
    console.log("[Cabs] Cabs Service Cron Jobs Initialized");
};
