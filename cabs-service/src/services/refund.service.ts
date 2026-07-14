import {
  CabBookingModel,
  CabBookingStatus,
  RefundStatus,
  RefundKind,
  PaymentMethod,
  ClientType,
  ICabBooking,
} from "../models/CabBooking.model";
import { WalletUtil } from "../utils/wallet.util";
import { PaymentUtil } from "../utils/payment.util";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** A claim left PROCESSING longer than this is treated as dead and retried. */
const STALE_CLAIM_MS = 30 * 60 * 1000;

export interface RefundOutcome {
  refunded: boolean;
  skipped: boolean; // another worker owns/finished it
  amount?: number;
  reason?: string;
}

interface RefundRequest {
  amount: number; // owed back to the payer, already net of any penalty
  reason: string;
  kind: RefundKind;
  finalStatus: CabBookingStatus; // where the booking lands once money is back
  zeroRefundExpected: boolean; // a ₹0 refund is normal for cancellations
  noInstrumentStatus: CabBookingStatus; // when there is nothing to refund *to*
}

/**
 * Cabs refund engine — same mechanism as hotel/flight:
 *  • the refund subdocument is claimed atomically, so the in-request path, the
 *    status poll and the reconciliation worker can all race without paying twice;
 *  • the rail (agent wallet vs Razorpay) is derived from the booking, never the
 *    caller, so we never pay the wrong instrument;
 *  • the booking only reaches its terminal status once the money is provably back.
 */
class RefundService {
  /**
   * The supplier never honoured the booking. Give back EVERYTHING the customer
   * paid (gross, incl. markup) — they received no service.
   */
  async refundFailedBooking(booking: ICabBooking, reason: string): Promise<RefundOutcome> {
    return this.execute(booking, {
      amount: round2(Number(booking.totalAmount) || 0),
      reason,
      kind: RefundKind.FAILED_BOOKING,
      finalStatus: CabBookingStatus.FAILED,
      zeroRefundExpected: false,
      noInstrumentStatus: CabBookingStatus.MANUAL_REVIEW,
    });
  }

  /**
   * Settle the customer side of a supplier-confirmed cancellation.
   *
   * Cabs policy: the customer gets back the API (supplier) price MINUS the
   * cancellation charges. Our markup and the penalty are RETAINED. The amount is
   * taken from the breakdown captured when the cancel was requested (the penalty
   * depends on *when* we asked), never recomputed here.
   */
  async settleCancellation(booking: ICabBooking, cancelChargesInfo: any): Promise<RefundOutcome> {
    const apiPrice = round2(booking.netAmount ?? booking.totalAmount ?? 0);

    // Prefer the supplier's exact post-penalty refund; else % of the api price.
    let refundAmount = Number(cancelChargesInfo?.refundAmount);
    if (!Number.isFinite(refundAmount)) {
      const pct = Number(cancelChargesInfo?.cancellation?.refundPercentage);
      refundAmount = Number.isFinite(pct)
        ? apiPrice * (Math.max(0, Math.min(100, pct)) / 100)
        : NaN;
    }

    if (!Number.isFinite(refundAmount)) {
      // Unknown penalty — refuse to guess. Park for ops.
      await CabBookingModel.findByIdAndUpdate(booking._id, {
        status: CabBookingStatus.MANUAL_REVIEW,
        failureReason:
          "Cancelled at the supplier, but the refund amount could not be determined.",
      });
      console.error(
        `[RefundService] ${booking.bookingId}: cancellation refund undetermined — parked for ops.`,
      );
      return { refunded: false, skipped: false, reason: "Refund amount undetermined" };
    }

    // Never hand back more than the api price (markup stays with us).
    refundAmount = round2(Math.max(0, Math.min(refundAmount, apiPrice)));

    return this.refundCancelledBooking(
      booking,
      refundAmount,
      `Cancellation refund (api price ₹${apiPrice} less cancellation charges; markup retained).`,
    );
  }

  /** Give back what the cancellation policy allows (already net of penalty). */
  async refundCancelledBooking(
    booking: ICabBooking,
    refundAmount: number,
    reason: string,
  ): Promise<RefundOutcome> {
    return this.execute(booking, {
      amount: round2(Math.max(0, Number(refundAmount) || 0)),
      reason,
      kind: RefundKind.CANCELLATION,
      finalStatus: CabBookingStatus.CANCELLED,
      zeroRefundExpected: true,
      noInstrumentStatus: CabBookingStatus.MANUAL_REVIEW,
    });
  }

  /** Retry a refund a previous attempt left FAILED, reusing its amount + kind. */
  async retryRefund(booking: ICabBooking): Promise<RefundOutcome> {
    const prior = booking.refund;
    if (!prior) return { refunded: false, skipped: true, reason: "No refund to retry" };
    const reason = prior.reason || "Retrying a previously failed refund.";
    return prior.kind === RefundKind.CANCELLATION
      ? this.refundCancelledBooking(booking, prior.amount || 0, reason)
      : this.refundFailedBooking(booking, reason);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async execute(booking: ICabBooking, req: RefundRequest): Promise<RefundOutcome> {
    // Fully-penalised cancellation owes nothing — close it out, move no money.
    if (req.amount <= 0) {
      if (!req.zeroRefundExpected) {
        return { refunded: false, skipped: true, reason: "Nothing to refund" };
      }
      await this.recordZeroRefund(booking, req);
      return { refunded: false, skipped: false, amount: 0, reason: "No refund due under policy" };
    }

    const method = this.resolveMethod(booking);
    if (method === PaymentMethod.NONE) {
      await this.markNoInstrument(booking, req);
      return {
        refunded: false,
        skipped: false,
        amount: req.amount,
        reason: "No wallet or captured payment to refund to",
      };
    }

    const claimed = await this.claim(booking, method, req);
    if (!claimed) {
      return { refunded: false, skipped: true, reason: "Refund already claimed by another worker" };
    }

    try {
      const providerRefundId =
        method === PaymentMethod.WALLET
          ? await this.refundToWallet(booking, req)
          : await this.refundToGateway(booking, req);

      await CabBookingModel.findByIdAndUpdate(booking._id, {
        $set: {
          status: req.finalStatus,
          "refund.status": RefundStatus.COMPLETED,
          "refund.completedAt": new Date(),
          ...(providerRefundId ? { "refund.providerRefundId": providerRefundId } : {}),
          ...(req.finalStatus === CabBookingStatus.FAILED ? { failureReason: req.reason } : {}),
        },
        $unset: { "refund.error": "" },
      });

      console.log(
        `[RefundService] Refunded ₹${req.amount} for ${booking.bookingId || booking._id} via ${method}.`,
      );
      return { refunded: true, skipped: false, amount: req.amount };
    } catch (err: any) {
      // FAILED is reclaimable → the next sweep retries. Never close the booking
      // out; never tell a customer their money is back when it isn't.
      await CabBookingModel.findByIdAndUpdate(booking._id, {
        $set: {
          "refund.status": RefundStatus.FAILED,
          "refund.error": String(err?.message || err).slice(0, 500),
        },
      });
      console.error(
        `[RefundService] Refund FAILED for ${booking.bookingId || booking._id} via ${method}:`,
        err?.message,
      );
      return { refunded: false, skipped: false, reason: err?.message };
    }
  }

  /** Where the money came from decides where it goes back. */
  private resolveMethod(booking: ICabBooking): PaymentMethod {
    if (booking.clientType === ClientType.B2B && booking.agentId) return PaymentMethod.WALLET;
    if (booking.razorpayPaymentId) return PaymentMethod.GATEWAY;
    // Fall back to how they paid, if recorded.
    if (booking.paymentMethod === PaymentMethod.WALLET && booking.agentId) return PaymentMethod.WALLET;
    return PaymentMethod.NONE;
  }

  /** Atomically take ownership. Wins if no refund exists, a prior FAILED, or a stale PROCESSING. */
  private async claim(
    booking: ICabBooking,
    method: PaymentMethod,
    req: RefundRequest,
  ): Promise<boolean> {
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
    const claimed = await CabBookingModel.findOneAndUpdate(
      {
        _id: booking._id,
        $or: [
          { refund: { $exists: false } },
          { "refund.status": { $exists: false } },
          { "refund.status": RefundStatus.FAILED },
          { "refund.status": RefundStatus.PROCESSING, "refund.attemptedAt": { $lt: staleBefore } },
        ],
      },
      {
        $set: {
          refund: {
            status: RefundStatus.PROCESSING,
            method,
            kind: req.kind,
            amount: req.amount,
            referenceId: booking.bookingId || String(booking._id),
            reason: req.reason,
            attemptedAt: new Date(),
          },
        },
      },
      { new: true },
    );
    return !!claimed;
  }

  private async recordZeroRefund(booking: ICabBooking, req: RefundRequest): Promise<void> {
    await CabBookingModel.findOneAndUpdate(
      { _id: booking._id, "refund.status": { $ne: RefundStatus.COMPLETED } },
      {
        $set: {
          status: req.finalStatus,
          refund: {
            status: RefundStatus.COMPLETED,
            method: PaymentMethod.NONE,
            kind: req.kind,
            amount: 0,
            referenceId: booking.bookingId || String(booking._id),
            reason: `${req.reason} No refund due under the cancellation policy.`,
            attemptedAt: new Date(),
            completedAt: new Date(),
          },
        },
      },
    );
    console.log(
      `[RefundService] ${booking.bookingId || booking._id}: no refund due (fully penalised). Closed as ${req.finalStatus}.`,
    );
  }

  private async markNoInstrument(booking: ICabBooking, req: RefundRequest): Promise<void> {
    await CabBookingModel.findOneAndUpdate(
      { _id: booking._id, "refund.status": { $ne: RefundStatus.COMPLETED } },
      {
        $set: {
          status: req.noInstrumentStatus,
          failureReason: `${req.reason} Manual refund of ₹${req.amount} required — no wallet or captured payment on record.`,
          refund: {
            status: RefundStatus.NOT_APPLICABLE,
            method: PaymentMethod.NONE,
            kind: req.kind,
            amount: req.amount,
            referenceId: booking.bookingId || String(booking._id),
            reason: req.reason,
            attemptedAt: new Date(),
          },
        },
      },
    );
    console.warn(
      `[RefundService] ${booking.bookingId || booking._id} has no refund instrument (clientType ${booking.clientType}). Owed ₹${req.amount}. Left in ${req.noInstrumentStatus}.`,
    );
  }

  private async refundToWallet(booking: ICabBooking, req: RefundRequest): Promise<string> {
    await WalletUtil.refundToAgentWallet(
      String(booking.agentId),
      req.amount,
      booking.bookingId || String(booking._id),
      `Cab booking refund: ${req.reason}`,
    );
    return "";
  }

  private async refundToGateway(booking: ICabBooking, req: RefundRequest): Promise<string> {
    return PaymentUtil.refundGatewayPayment(
      booking.razorpayPaymentId!,
      req.amount,
      booking.bookingId || String(booking._id),
      `Cab booking refund: ${req.reason}`,
      "B2C",
    );
  }
}

export const refundService = new RefundService();
