import {
  BookingModel,
  BookingStatus,
  RefundKind,
  RefundMethod,
  RefundStatus,
} from "../models/Booking.model";
import { BookingEventLogger } from "../models/BookingEvent";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { WalletUtil } from "../utils/wallet.util";
import { PaymentUtil } from "../utils/payment.util";
import { round2 } from "../utils/pricing.util";
import { resolveCancellationRefund } from "../utils/cancellationRefund.util";
import { notificationService } from "./notification.service";

/**
 * A refund claimed but never finished — the process died mid-flight — is
 * retried after this window. Long enough that a slow-but-live Razorpay call is
 * never double-issued.
 */
const STALE_CLAIM_MS = 30 * 60 * 1000;

export interface RefundOutcome {
  refunded: boolean;
  /** True when another worker already owns or completed this refund. */
  skipped: boolean;
  amount?: number;
  reason?: string;
}

interface RefundRequest {
  /** Amount owed back to the payer, already net of any cancellation penalty. */
  amount: number;
  reason: string;
  kind: RefundKind;
  /** Where the booking lands once the money is provably back. */
  finalStatus: BookingStatus;
  /**
   * True for cancellations, where a fully-penalised (₹0) refund is a normal
   * outcome rather than a sign that something is wrong.
   */
  zeroRefundExpected: boolean;
  /** Status to park the booking in when there is nothing to refund *to*. */
  noInstrumentStatus: BookingStatus;
}

class RefundService {
  /**
   * The supplier never honoured the booking. Give back everything the payer paid.
   */
  async refundFailedBooking(
    booking: any,
    reason: string,
  ): Promise<RefundOutcome> {
    return this.execute(booking, {
      amount: round2(Number(booking.totalAmount) || 0),
      reason,
      kind: RefundKind.FAILED_BOOKING,
      finalStatus: BookingStatus.FAILED,
      zeroRefundExpected: false,
      noInstrumentStatus: BookingStatus.MANUAL_REVIEW,
    });
  }

  /**
   * Settle the customer side of a cancellation the supplier has confirmed.
   *
   * TripJack credits *our* deposit when a booking is cancelled inside the
   * permitted window — nothing reaches the traveller until we push it back
   * ourselves. This is that push.
   *
   * Refuses to guess: when the penalty is unknown or nonsensical the booking is
   * parked for a human rather than refunded at a made-up amount.
   *
   * @param cancelChargesInfo the breakdown captured when the cancellation was
   *   requested. The penalty depends on *when* we asked, not on when the refund
   *   is finally processed, so it must not be recomputed here.
   */
  async settleCancellation(
    booking: any,
    cancelChargesInfo: any,
  ): Promise<RefundOutcome> {
    const resolution = resolveCancellationRefund(booking, cancelChargesInfo);

    if (!resolution.ok) {
      await hotelBookingRepository.findByIdAndUpdate(booking._id, {
        status: BookingStatus.MANUAL_REVIEW,
        failureReason: `Cancelled at the supplier, but the refund amount could not be determined: ${resolution.reason}`,
      });
      console.error(
        `[RefundService] ${booking.confirmationNumber}: refund not auto-processed — ${resolution.reason}`,
      );
      return { refunded: false, skipped: false, reason: resolution.reason };
    }

    return this.refundCancelledBooking(
      booking,
      resolution.refundAmount,
      `Cancelled within the permitted window. Paid ₹${resolution.totalPaid}, supplier penalty ₹${resolution.penalty}.`,
    );
  }

  /**
   * Give back what the cancellation policy allows.
   *
   * `refundAmount` must already have the supplier's penalty deducted. The
   * booking still becomes CANCELLED even when nothing is owed — it was
   * genuinely cancelled at the supplier, and the refund subdocument carries the
   * ops signal.
   */
  async refundCancelledBooking(
    booking: any,
    refundAmount: number,
    reason: string,
  ): Promise<RefundOutcome> {
    return this.execute(booking, {
      amount: round2(Math.max(0, Number(refundAmount) || 0)),
      reason,
      kind: RefundKind.CANCELLATION,
      finalStatus: BookingStatus.CANCELLED,
      zeroRefundExpected: true,
      noInstrumentStatus: BookingStatus.MANUAL_REVIEW,
    });
  }

  /**
   * Retry a refund a previous attempt left in FAILED. Reuses the original
   * amount and kind — a cancellation must never be retried as a full refund.
   */
  async retryRefund(booking: any): Promise<RefundOutcome> {
    const prior = booking.refund;
    if (!prior)
      return { refunded: false, skipped: true, reason: "No refund to retry" };

    const reason = prior.reason || "Retrying a previously failed refund.";

    return prior.kind === RefundKind.CANCELLATION
      ? this.refundCancelledBooking(booking, prior.amount, reason)
      : this.refundFailedBooking(booking, reason);
  }

  /**
   * Move the money and close the booking out.
   *
   * B2B agents paid from their Klar wallet; B2C and GUEST customers paid
   * Razorpay. Picking the wrong instrument means either paying twice or not at
   * all, so the method is derived from the booking, never from the caller.
   *
   * Safe to call from the poll, the status cron and the reconciliation worker
   * concurrently: exactly one caller claims the refund and moves money.
   */
  private async execute(
    booking: any,
    req: RefundRequest,
  ): Promise<RefundOutcome> {
    // A fully-penalised cancellation owes nothing. Record it so the booking is
    // closed and no worker keeps retrying, but move no money.
    if (req.amount <= 0) {
      if (!req.zeroRefundExpected) {
        return { refunded: false, skipped: true, reason: "Nothing to refund" };
      }
      const updated = await this.recordZeroRefund(booking, req);
      if (updated) {
        notificationService.sendBookingStatusEmail(updated, req.finalStatus);
      }
      return {
        refunded: false,
        skipped: false,
        amount: 0,
        reason: "No refund due under the cancellation policy",
      };
    }

    const method = this.resolveMethod(booking);

    if (method === RefundMethod.NONE) {
      const updated = await this.markNoInstrument(booking, req);
      if (updated) {
        notificationService.sendBookingStatusEmail(
          updated,
          req.noInstrumentStatus,
        );
      }
      return {
        refunded: false,
        skipped: false,
        amount: req.amount,
        reason: "No wallet or captured payment to refund to",
      };
    }

    const claimed = await this.claim(booking, method, req);
    if (!claimed) {
      return {
        refunded: false,
        skipped: true,
        reason: "Refund already claimed or completed by another worker",
      };
    }

    try {
      const providerRefundId =
        method === RefundMethod.WALLET
          ? await this.refundToWallet(booking, req)
          : await this.refundToGateway(booking, req);

      await hotelBookingRepository.findByIdAndUpdate(booking._id, {
        $set: {
          "refund.status": RefundStatus.COMPLETED,
          "refund.completedAt": new Date(),
          ...(providerRefundId
            ? { "refund.providerRefundId": providerRefundId }
            : {}),
        },
        $unset: { "refund.error": "" },
      });

      // Only close the booking out once the money is provably back.
      const transitioned = await hotelBookingRepository.transitionStatus(
        booking._id,
        req.finalStatus,
        req.finalStatus === BookingStatus.FAILED
          ? { failureReason: req.reason }
          : {},
      );

      if (transitioned) {
        notificationService.sendBookingStatusEmail(
          transitioned,
          req.finalStatus,
        );
      }

      await BookingEventLogger.log(
        booking.confirmationNumber,
        "REFUND-SERVICE",
        "REFUND_COMPLETED",
        { amount: req.amount, method, providerRefundId },
      );

      console.log(
        `[RefundService] Refunded ₹${req.amount} for ${booking.confirmationNumber} via ${method}.`,
      );
      return { refunded: true, skipped: false, amount: req.amount };
    } catch (err: any) {
      // FAILED is reclaimable, so the next sweep retries. The booking is not
      // closed out: never tell a customer their money is back when it isn't.
      await hotelBookingRepository.findByIdAndUpdate(booking._id, {
        $set: {
          "refund.status": RefundStatus.FAILED,
          "refund.error": err?.message?.slice(0, 500),
        },
      });

      await BookingEventLogger.log(
        booking.confirmationNumber,
        "REFUND-SERVICE",
        "REFUND_FAILED",
        { amount: req.amount, method, error: err?.message },
      );

      console.error(
        `[RefundService] Refund FAILED for ${booking.confirmationNumber} via ${method}:`,
        err?.message,
      );
      return { refunded: false, skipped: false, reason: err?.message };
    }
  }

  /** Where the money came from decides where it goes back. */
  private resolveMethod(booking: any): RefundMethod {
    if (booking.clientType === "B2B" && booking.agentId) {
      return RefundMethod.WALLET;
    }
    if (booking.razorpayPaymentId) {
      return RefundMethod.RAZORPAY;
    }
    return RefundMethod.NONE;
  }

  /**
   * Atomically take ownership of the refund.
   *
   * Wins only if no refund exists, a previous attempt FAILED, or a PROCESSING
   * claim has gone stale. Returns false when someone else holds it.
   */
  private async claim(
    booking: any,
    method: RefundMethod,
    req: RefundRequest,
  ): Promise<boolean> {
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

    const claimed = await BookingModel.findOneAndUpdate(
      {
        _id: booking._id,
        $or: [
          { refund: { $exists: false } },
          { "refund.status": RefundStatus.FAILED },
          {
            "refund.status": RefundStatus.PROCESSING,
            "refund.attemptedAt": { $lt: staleBefore },
          },
        ],
      },
      {
        $set: {
          refund: {
            status: RefundStatus.PROCESSING,
            method,
            kind: req.kind,
            amount: req.amount,
            referenceId: booking.confirmationNumber,
            reason: req.reason,
            attemptedAt: new Date(),
          },
        },
      },
      { new: true },
    );

    return !!claimed;
  }

  /** Non-refundable rate, or cancelled past the free window. Nothing owed. */
  private async recordZeroRefund(
    booking: any,
    req: RefundRequest,
  ): Promise<any> {
    const updated = await BookingModel.findOneAndUpdate(
      { _id: booking._id, "refund.status": { $ne: RefundStatus.COMPLETED } },
      {
        $set: {
          refund: {
            status: RefundStatus.COMPLETED,
            method: RefundMethod.NONE,
            kind: req.kind,
            amount: 0,
            referenceId: booking.confirmationNumber,
            reason: `${req.reason} No refund due under the cancellation policy.`,
            attemptedAt: new Date(),
            completedAt: new Date(),
          },
          status: req.finalStatus,
        },
      },
      { new: true },
    );

    console.log(
      `[RefundService] ${booking.confirmationNumber}: no refund due (fully penalised). Closed as ${req.finalStatus}.`,
    );
    return updated;
  }

  private async markNoInstrument(
    booking: any,
    req: RefundRequest,
  ): Promise<any> {
    const updated = await BookingModel.findOneAndUpdate(
      { _id: booking._id, "refund.status": { $ne: RefundStatus.COMPLETED } },
      {
        $set: {
          refund: {
            status: RefundStatus.NOT_APPLICABLE,
            method: RefundMethod.NONE,
            kind: req.kind,
            amount: req.amount,
            referenceId: booking.confirmationNumber,
            reason: req.reason,
            attemptedAt: new Date(),
          },
          status: req.noInstrumentStatus,
          failureReason: `${req.reason} Manual refund of ₹${req.amount} required — no wallet or captured payment on record.`,
        },
      },
      { new: true },
    );

    console.warn(
      `[RefundService] ${booking.confirmationNumber} has no refund instrument (clientType: ${booking.clientType}, agentId: ${booking.agentId || "n/a"}). Owed ₹${req.amount}. Left in ${req.noInstrumentStatus}.`,
    );
    return updated;
  }

  private async refundToWallet(
    booking: any,
    req: RefundRequest,
  ): Promise<string> {
    await WalletUtil.refundToAgentWallet(
      booking.agentId,
      req.amount,
      booking.confirmationNumber,
      `Hotel booking refund: ${req.reason}`,
    );
    return "";
  }

  private async refundToGateway(
    booking: any,
    req: RefundRequest,
  ): Promise<string> {
    return PaymentUtil.refundGatewayPayment(
      booking.razorpayPaymentId,
      req.amount,
      booking.confirmationNumber,
      `Hotel booking refund: ${req.reason}`,
      "B2C",
    );
  }
}

export const refundService = new RefundService();
