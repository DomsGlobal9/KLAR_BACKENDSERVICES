import cron from "node-cron";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { BookingStatus, RefundStatus } from "../models/Booking.model";
import { bookingsService } from "../services/bookings.service";
import { refundService } from "../services/refund.service";

/**
 * Don't touch a booking until the in-request poll (180s) and a couple of
 * status-cron ticks have had their chance to resolve it.
 */
const SETTLE_GRACE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Only refund once the supplier has had a genuinely long time to answer and is
 * still not reporting a reservation. Refunding earlier risks paying the agent
 * back for a booking TripJack went on to confirm.
 */
const REFUND_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours

export class ReconciliationWorker {
  public static start() {
    console.log(
      "[ReconciliationWorker] Starting background cron job (runs every 2 minutes)...",
    );

    // Run every 2 minutes
    cron.schedule("*/2 * * * *", async () => {
      if (process.env.ENABLE_AUTO_REFUNDS === "false") {
        console.log(
          "[ReconciliationWorker] Auto-refunds are disabled (ENABLE_AUTO_REFUNDS=false). Skipping sweep.",
        );
        return;
      }

      console.log("[ReconciliationWorker] Sweeping for stuck bookings...");
      try {
        // CANCELLATION_PENDING is deliberately excluded: those bookings are
        // being cancelled, not created. Refunding them the full amount here
        // would hand back the supplier's cancellation penalty as well.
        const stuckBookings = await hotelBookingRepository.find({
          status: {
            $in: [
              BookingStatus.MANUAL_REVIEW,
              BookingStatus.PENDING,
              BookingStatus.SUPPLIER_PENDING,
            ],
          },
          createdAt: { $lt: new Date(Date.now() - SETTLE_GRACE_MS) },
        });

        console.log(
          `[ReconciliationWorker] Found ${stuckBookings.length} stuck bookings.`,
        );

        for (const booking of stuckBookings) {
          await this.resolveStuckBooking(booking);
        }

        await this.escalateStuckCancellations();
        await this.retryFailedRefunds();
      } catch (error) {
        console.error("[ReconciliationWorker] Sweep failed:", error);
      }
    });
  }

  /**
   * A cancellation the supplier never terminalized. The traveller has been told
   * their refund is coming, so this must not sit silently — but we still refuse
   * to refund a booking the supplier might not have cancelled.
   */
  private static async escalateStuckCancellations() {
    const stuck = await hotelBookingRepository.find({
      status: BookingStatus.CANCELLATION_PENDING,
      updatedAt: { $lt: new Date(Date.now() - REFUND_AFTER_MS) },
    });

    for (const booking of stuck) {
      const synced = await bookingsService.syncBookingStatus(booking);
      if (synced.status !== BookingStatus.CANCELLATION_PENDING) continue;

      await hotelBookingRepository.transitionStatus(
        booking._id,
        BookingStatus.MANUAL_REVIEW,
        {
          failureReason:
            "Supplier never confirmed the cancellation. The refund is owed but cannot be issued automatically.",
        },
      );
      console.error(
        `[ReconciliationWorker] ${booking.confirmationNumber} stuck in CANCELLATION_PENDING; escalated to MANUAL_REVIEW.`,
      );
    }
  }

  /**
   * A refund that errored leaves the booking terminal (FAILED) with
   * `refund.status: FAILED`, which the stuck-booking filter above skips. Pick
   * those up separately so a transient auth-service or Razorpay outage doesn't
   * strand a customer's money indefinitely.
   */
  private static async retryFailedRefunds() {
    const pendingRefunds = await hotelBookingRepository.find({
      "refund.status": RefundStatus.FAILED,
    });

    if (!pendingRefunds.length) return;

    console.log(
      `[ReconciliationWorker] Retrying ${pendingRefunds.length} failed refunds.`,
    );

    for (const booking of pendingRefunds) {
      try {
        // retryRefund reuses the original amount and kind — retrying a
        // cancellation as a failed-booking refund would hand back the penalty too.
        await refundService.retryRefund(booking);
      } catch (error) {
        console.error(
          `[ReconciliationWorker] Refund retry threw for ${booking.confirmationNumber}:`,
          error,
        );
      }
    }
  }

  private static async resolveStuckBooking(booking: any) {
    try {
      console.log(
        `[ReconciliationWorker] Resolving booking: ${booking.confirmationNumber}`,
      );

      // Ask the supplier what actually happened. syncBookingStatus persists any
      // transition and emails the voucher if the booking turns out CONFIRMED.
      const synced = await bookingsService.syncBookingStatus(booking);

      // Supplier resolved it in our favour, or the cancel flow owns it.
      if (
        synced.status === BookingStatus.CONFIRMED ||
        synced.status === BookingStatus.HELD ||
        synced.status === BookingStatus.CANCELLED
      ) {
        console.log(
          `[ReconciliationWorker] ${booking.confirmationNumber} resolved to ${synced.status} by the supplier.`,
        );
        return;
      }

      // Already FAILED: syncBookingStatus refunds on the transition, but a
      // booking that failed before that logic existed (or whose refund errored)
      // still needs one. refundFailedBooking is idempotent, so retry it.
      if (synced.status === BookingStatus.FAILED) {
        await refundService.refundFailedBooking(
          synced,
          "Supplier reported the booking as failed.",
        );
        return;
      }

      const ageMs = Date.now() - new Date(booking.createdAt).getTime();
      if (ageMs < REFUND_AFTER_MS) {
        console.log(
          `[ReconciliationWorker] ${booking.confirmationNumber} still unresolved after ${Math.round(ageMs / 60000)}m — waiting before refund.`,
        );
        return;
      }

      // The supplier never gave us a reservation. Hand the booking to the refund
      // service, which picks the agent wallet or the Razorpay payment based on
      // the record, claims the refund so no other worker duplicates it, and only
      // closes the booking out to FAILED once the money is provably back.
      await refundService.refundFailedBooking(
        booking,
        "Supplier never confirmed the reservation; closed by the Reconciliation Worker.",
      );
    } catch (error) {
      console.error(
        `[ReconciliationWorker] Failed to resolve booking ${booking._id}:`,
        error,
      );
    }
  }
}
