import { deleteExpiredPendingBookingsJob } from "./jobs/deleteExpiredPendingBookings.job";

// NOTE: checkBookingStatusJob is intentionally NOT registered. It flipped
// PENDING bookings to FAILED on a supplier FAILED/CANCELLED WITHOUT issuing a
// refund, and the ReconciliationWorker (started in server.ts) never revisits
// FAILED — so a paid customer's money got stranded. ReconciliationWorker now
// owns status reconciliation and refunds correctly; this legacy sweeper is
// superseded. See CABS_MODULE_AUDIT.md (CAB-H4).
export const initializeCronJobs = () => {
    deleteExpiredPendingBookingsJob();
    console.log("[Cabs] Cabs Service Cron Jobs Initialized");
};
