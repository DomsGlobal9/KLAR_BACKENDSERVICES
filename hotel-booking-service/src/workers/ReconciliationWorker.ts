import cron from "node-cron";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { BookingStatus } from "../models/Booking.model";
import { WalletUtil } from "../utils/wallet.util";
import { BookingEventLogger } from "../models/BookingEvent";

export class ReconciliationWorker {
    public static start() {
        console.log("[ReconciliationWorker] Starting background cron job (runs every 15 minutes)...");
        
        // Run every 15 minutes
        cron.schedule("*/15 * * * *", async () => {
            console.log("[ReconciliationWorker] Sweeping for stuck bookings...");
            try {
                // Find bookings stuck in MANUAL_REVIEW or old PENDING ones
                const stuckBookings = await hotelBookingRepository.find({
                    status: { $in: [BookingStatus.MANUAL_REVIEW, BookingStatus.PENDING, BookingStatus.SUPPLIER_PENDING] },
                    // Only pick ones that are at least 5 minutes old to avoid touching active bookings
                    createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
                });

                console.log(`[ReconciliationWorker] Found ${stuckBookings.length} stuck bookings.`);

                for (const booking of stuckBookings) {
                    await this.resolveStuckBooking(booking);
                }
            } catch (error) {
                console.error("[ReconciliationWorker] Sweep failed:", error);
            }
        });
    }

    private static async resolveStuckBooking(booking: any) {
        try {
            console.log(`[ReconciliationWorker] Resolving booking: ${booking.confirmationNumber}`);
            
            // Logic to verify real status with supplier goes here...
            // For now, if it's MANUAL_REVIEW and B2B, auto-refund to prevent hanging balances
            if (booking.status === BookingStatus.MANUAL_REVIEW && booking.agentId && booking.totalAmount > 0) {
                const token = "admin-bypass-token"; // Admin context for worker
                const demandId = booking.confirmationNumber;
                
                console.log(`[ReconciliationWorker] Refunding stuck manual review booking: ${booking.confirmationNumber}`);
                await WalletUtil.refundBalance(token, booking.totalAmount, demandId, "Reconciliation Worker: Auto-refund for unresolved booking");
                
                booking.status = BookingStatus.FAILED;
                booking.failureReason = "Auto-refunded by Reconciliation Worker due to prolonged MANUAL_REVIEW status.";
                await booking.save();
                
                await BookingEventLogger.log(booking.confirmationNumber, "CRON-WORKER", "RECONCILIATION_REFUND", { amount: booking.totalAmount });
            }
        } catch (error) {
            console.error(`[ReconciliationWorker] Failed to resolve booking ${booking._id}:`, error);
        }
    }
}
