import cron from "node-cron";
import { CRON_TIME } from "../../config/cron.config";
import { CabBookingStatus } from "../../models/CabBooking.model";
import { cabBookingRepository } from "../../repositories/cabBooking.repository";
import { tripJackCabsProvider } from "../../providers/tripjack.cabs.provider";

let isRunning = false;

/**
 * Initialize Booking Status Cron
 */
export const checkBookingStatusJob = () => {
    cron.schedule(
        CRON_TIME.EVERY_2_MINUTES,
        executeBookingStatusCron
    );
};

/**
 * Main Cron Executor
 */
const executeBookingStatusCron = async () => {
    if (isRunning) {
        return;
    }

    isRunning = true;

    try {
        const bookings = await cabBookingRepository.getBookingsByStatus(CabBookingStatus.PENDING);

        if (!bookings.length) {
            return;
        }

        await processBookings(bookings);

    } catch (error: any) {
        console.error(
            "[Cabs] Booking status cron failed >>>",
            error.message
        );
    } finally {
        isRunning = false;
    }
};

const processBookings = async (bookings: any[]) => {
    for (const booking of bookings) {
        await processSingleBooking(booking);
    }
};

const processSingleBooking = async (booking: any) => {
    try {
        const idToSync = booking.bookingId;
        
        const detailsRes = await tripJackCabsProvider.getBookingDetails(idToSync);
        const finalStatus = detailsRes?.data?.[0]?.order?.status;
        const finalPaymentStatus = detailsRes?.data?.[0]?.order?.paymentStatus;
        
        let newStatus = booking.status;
        
        if (finalStatus === "CONFIRMED" || finalStatus === "PAYMENT_SUCCESS") {
            newStatus = CabBookingStatus.CONFIRMED;
        } else if (finalStatus === "FAILED" || finalStatus === "CANCELLED") {
            newStatus = CabBookingStatus.FAILED;
        }

        if (newStatus !== booking.status) {
            await cabBookingRepository.updateBookingStatusAndResponse(idToSync, newStatus, detailsRes);
            console.log(`[Cabs] Updated Booking: ${idToSync} | ${booking.status} -> ${newStatus}`);
        }
        
        console.log(`[Cabs] Successfully checked booking status for: ${idToSync}`);
    } catch (error: any) {
        console.error(
            `[Cabs] Booking status check failed for ID: ${booking.bookingId}`,
            error.message
        );
    }
};
