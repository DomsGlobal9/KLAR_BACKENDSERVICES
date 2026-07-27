import { cronConfig } from "../config/corn.config";
import { deleteExpiredInitiatedBookingsJob } from "./jobs/deleteExpiredInitiatedBookings.job";
import { checkBookingStatusJob } from "./jobs/checkBookingStatus.job";
import { calculateCancellationRefundJob } from "./jobs/calculateCancellationRefund.job";

export const initializeCrons = () => {

    if (!cronConfig.enabled) {

        return;
    }



    checkBookingStatusJob();

    deleteExpiredInitiatedBookingsJob();

    // calculateCancellationRefundJob();


};