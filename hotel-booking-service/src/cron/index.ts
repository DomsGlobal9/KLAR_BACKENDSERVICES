import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";
import { deleteExpiredPendingBookingsJob } from "./jobs/deleteExpiredPendingBookings.job";
import { ReconciliationWorker } from "../workers/ReconciliationWorker";

export const initializeCronJobs = () => {
  checkBookingStatusJob();
  deleteExpiredPendingBookingsJob();
  ReconciliationWorker.start();
  console.log("Hotel Booking Service Cron Jobs Initialized");
};
