import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";
import { deleteExpiredPendingBookingsJob } from "./jobs/deleteExpiredPendingBookings.job";

export const initializeCronJobs = () => {
    checkBookingStatusJob();
    deleteExpiredPendingBookingsJob();
    console.log("Hotel Booking Service Cron Jobs Initialized");
};
