import cron from "node-cron";
import { CRON_TIME } from "../../config/corn.config";
import { cancellationPriceService } from "../../services/cancellationRefund.service";
import { BookingModel } from "../../model/bookingLocal.model";

let isRunning = false;

export const calculateCancellationRefundJob = () => {
    cron.schedule(
        CRON_TIME.EVERY_30_SECONDS,
        executeCancellationRefundCron
    );
};

const executeCancellationRefundCron = async () => {
    if (isRunning) {
        return;
    }

    isRunning = true;

    try {
        const bookings = await getPendingRefundBookings();

        if (bookings.length === 0) {
            return;
        }

        await processRefundBookings(bookings);

    } catch (error: any) {
        // Error handling without console
    } finally {
        isRunning = false;
    }
};

const getPendingRefundBookings = async () => {
    const bookingData = await BookingModel.find({
        status: { $in: ['CANCELLED'] },
        refundProcessed: false
    });

    return bookingData;
};

const processRefundBookings = async (bookings: any[]) => {
    for (const booking of bookings) {
        await processSingleRefund(booking);
    }
};

const processSingleRefund = async (booking: any) => {
    try {
        const result = await cancellationPriceService.processRefundAndCreditWallet(booking.bookingId);

        if (result.walletCredited) {

        } else {

        }

    } catch (error: any) {
        // Error handling without console
    }
};