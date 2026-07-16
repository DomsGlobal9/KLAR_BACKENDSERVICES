import cron from "node-cron";
import { cabBookingRepository } from "../repositories/cabBooking.repository";
import {
  CabBookingModel,
  CabBookingStatus,
  RefundStatus,
  ICabBooking,
} from "../models/CabBooking.model";
import { cabSupplierRegistry } from "../suppliers/registry";
import { notificationService } from "../services/notification.service";
import { refundService } from "../services/refund.service";

/**
 * Don't touch a booking until the in-request poll and a status tick have had a
 * chance to resolve it.
 */
const SETTLE_GRACE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Only give up on a still-pending booking after the supplier has had a long time
 * to answer and still hasn't confirmed.
 */
const ESCALATE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Background sweeper for cab bookings the in-request flow left non-terminal
 * (INITIATED / PENDING / SUPPLIER_PENDING). Asks the supplier what happened and
 * transitions the record; genuinely-failed bookings are refunded through the
 * shared RefundService (which pays the agent wallet via the internal credit
 * route, or Razorpay — no user token needed). Also retries refunds a previous
 * attempt left FAILED. Cabs equivalent of hotel's ReconciliationWorker.
 */
export class ReconciliationWorker {
  public static start() {
    console.log(
      "[ReconciliationWorker] Starting cab booking sweeper (every 2 minutes)...",
    );

    cron.schedule("*/2 * * * *", async () => {
      try {
        const stuck = await cabBookingRepository.find({
          status: {
            $in: [
              CabBookingStatus.INITIATED,
              CabBookingStatus.PENDING,
              CabBookingStatus.SUPPLIER_PENDING,
            ],
          },
          createdAt: { $lt: new Date(Date.now() - SETTLE_GRACE_MS) },
        });

        if (stuck.length) {
          console.log(`[ReconciliationWorker] ${stuck.length} stuck booking(s) to resolve.`);
          for (const booking of stuck) await this.resolve(booking);
        }

        await this.retryFailedRefunds();
      } catch (error) {
        console.error("[ReconciliationWorker] Sweep failed:", error);
      }
    });
  }

  private static async resolve(booking: ICabBooking) {
    try {
      const ageMs = Date.now() - new Date(booking.createdAt).getTime();

      // Never reached the supplier (no bookingId). Give it the escalation window,
      // then refund/close.
      if (!booking.bookingId) {
        if (ageMs > ESCALATE_AFTER_MS) {
          await refundService.refundFailedBooking(
            booking,
            "INITIATED booking never produced a supplier id.",
          );
        }
        return;
      }

      const supplier = cabSupplierRegistry.getByCode("TJ");
      const detailsRes = await supplier?.adapter.pollStatus?.(booking.bookingId);
      const supplierStatus: string | undefined = detailsRes?.data?.[0]?.order?.status;

      // UAT reports a paid booking as "SUCCESS"; live/doc show "CONFIRMED"/"PAYMENT_SUCCESS".
      if (supplierStatus === "CONFIRMED" || supplierStatus === "PAYMENT_SUCCESS" || supplierStatus === "SUCCESS") {
        await this.transition(booking, CabBookingStatus.CONFIRMED, detailsRes);
        const saved = await CabBookingModel.findById(booking._id);
        if (saved) notificationService.sendBookingConfirmation(saved);
        console.log(`[ReconciliationWorker] ${booking.bookingId} -> CONFIRMED.`);
        return;
      }

      if (supplierStatus === "CANCELLED") {
        await this.transition(booking, CabBookingStatus.CANCELLED, detailsRes);
        return;
      }

      if (supplierStatus === "FAILED") {
        await refundService.refundFailedBooking(booking, "Supplier reported the booking as FAILED.");
        return;
      }

      // Still non-terminal past the window — the supplier never gave us a ride.
      if (ageMs > ESCALATE_AFTER_MS) {
        await refundService.refundFailedBooking(
          booking,
          "Supplier never confirmed the booking within the reconciliation window.",
        );
      }
    } catch (error) {
      console.error(
        `[ReconciliationWorker] Failed to resolve ${booking.bookingId || booking._id}:`,
        error,
      );
    }
  }

  /**
   * A refund a previous attempt left FAILED (transient auth-service/Razorpay
   * outage) strands the customer's money. Retry it — RefundService reuses the
   * original amount + kind and is safe to call repeatedly.
   */
  private static async retryFailedRefunds() {
    const pending = await cabBookingRepository.find({ "refund.status": RefundStatus.FAILED });
    if (!pending.length) return;
    console.log(`[ReconciliationWorker] Retrying ${pending.length} failed refund(s).`);
    for (const booking of pending) {
      try {
        await refundService.retryRefund(booking);
      } catch (e) {
        console.error(
          `[ReconciliationWorker] Refund retry threw for ${booking.bookingId || booking._id}:`,
          e,
        );
      }
    }
  }

  private static async transition(
    booking: ICabBooking,
    status: CabBookingStatus,
    response?: any,
  ) {
    booking.status = status;
    if (response) booking.tripJackResponse = response;
    await booking.save();
  }
}
