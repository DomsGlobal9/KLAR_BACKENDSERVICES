import { cabSupplierRegistry } from "../suppliers/registry";
import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { CancellationRequest } from "../models/tripjack.types";
import { CabBookingModel, CabBookingStatus } from "../models/CabBooking.model";
import { refundService } from "./refund.service";
import { StructuredError } from "./StructuredError";
import { Caller, assertBookingOwnership } from "../utils/ownership.util";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Cancellation — same mechanism as hotel/flight:
 *   1. preview the cancel charges (so the penalty reflects *when* we asked),
 *   2. cancel at the supplier,
 *   3. store the breakdown and hand the customer refund to RefundService, which
 *      claims it atomically and pays the right rail (agent wallet / Razorpay).
 *
 * Cabs refund policy: customer gets the API (supplier) price minus cancellation
 * charges; our markup and the penalty are retained (see RefundService).
 */
class AmendmentService {
  /**
   * Preview cancel charges. Returns a unified shape (like hotel's
   * getCancelCharges): what the customer paid, the charge, and what they'd get
   * back — computed from TripJack's amendment-charges API.
   */
  async getCharges(bookingId: string, type: string = "CANCELLATION", caller?: Caller) {
    if (!bookingId)
      throw new StructuredError("VALIDATION_ERROR", "bookingId is required.");

    const booking = await CabBookingModel.findOne({ 
      $or: [
        { klarBookingId: bookingId },
        { bookingId: bookingId }
      ]
    });
    // A caller is passed for direct API access; assert ownership before we reveal
    // any booking-specific charge/refund detail. Internal calls (from
    // processCancellation, which already checked ownership) pass no caller.
    if (caller) assertBookingOwnership(booking, caller);
    
    // We must pass the provider's bookingId to TripJack, not our klarBookingId
    const providerBookingId = booking?.bookingId || bookingId;
    const totalAmount = round2(booking?.totalAmount ?? 0); // gross the customer paid
    const apiPrice = round2(booking?.netAmount ?? booking?.totalAmount ?? 0);

    let raw: any = null;
    try {
      raw = await tripJackCabsProvider.getAmendmentCharges(providerBookingId, type);
    } catch (e: any) {
      console.warn(`[AmendmentService] getAmendmentCharges failed for ${providerBookingId}: ${e?.message}`);
    }

    const amd = raw?.data?.amendment || raw?.data || {};
    const cfg = amd?.appliedAmendmentConfig || {};
    const supplierRefund = Number(amd?.refundAmount);
    const charge = Number(amd?.tjAmendmentCharge ?? 0) + Number(amd?.tjManagementFee ?? 0);

    // Customer refund = supplier refund, capped at the api price (markup retained).
    let customerRefund = Number.isFinite(supplierRefund)
      ? Math.min(supplierRefund, apiPrice)
      : NaN;
    if (!Number.isFinite(customerRefund) && Number.isFinite(Number(cfg?.refundPercentage))) {
      customerRefund = apiPrice * (Math.max(0, Math.min(100, Number(cfg.refundPercentage))) / 100);
    }

    return {
      success: true,
      statusCode: 200,
      bookingId,
      totalAmount,
      applicableCharge: Number.isFinite(charge) ? round2(charge) : null,
      refundAmount: Number.isFinite(customerRefund) ? round2(Math.max(0, customerRefund)) : null,
      currency: booking?.currency || "INR",
      cancellation: {
        isRefundable: Number.isFinite(customerRefund) ? customerRefund > 0 : undefined,
        refundPercentage: Number.isFinite(Number(cfg?.refundPercentage))
          ? Number(cfg.refundPercentage)
          : undefined,
        description: cfg?.description || amd?.description,
      },
      raw: raw?.data ?? null,
    };
  }

  /**
   * Cancel a booking at the supplier, then settle the customer refund.
   */
  async processCancellation(payload: CancellationRequest, caller: Caller) {
    if (!payload.bookingId)
      throw new StructuredError(
        "VALIDATION_ERROR",
        "bookingId is required for cancellation.",
      );

    // 0. Ownership gate — cancellation is destructive and moves money, so a bare
    //    bookingId is never enough. The caller must own the booking (token
    //    identity, admin, or a matching guest capability proof).
    const owned = await CabBookingModel.findOne({ 
      $or: [
        { klarBookingId: payload.bookingId },
        { bookingId: payload.bookingId }
      ]
    });
    assertBookingOwnership(owned, caller);

    const providerBookingId = owned?.bookingId || payload.bookingId;

    // 1. Capture the charge breakdown BEFORE cancelling (penalty depends on now).
    let cancelChargesInfo: any = null;
    try {
      cancelChargesInfo = await this.getCharges(providerBookingId, "CANCELLATION");
    } catch (e: any) {
      console.warn(`[AmendmentService] Could not pre-calc cancel charges: ${e?.message}`);
    }

    // 2. Cancel at the supplier.
    const finalPayload = { ...payload, bookingId: providerBookingId, amendmentType: "CANCELLATION" as const };
    const supplier = cabSupplierRegistry.getByCode("TJ");
    const result = supplier?.adapter.cancel
      ? await supplier.adapter.cancel(finalPayload)
      : await tripJackCabsProvider.processAmendment(finalPayload);

    const cancelled = result?.success || result?.data?.amendStatus === "SUCCESS";
    if (!cancelled) return result;

    const booking = owned;
    if (!booking) {
      console.warn(
        `[AmendmentService] Cancelled ${providerBookingId} at supplier but no local record found.`,
      );
      return result;
    }

    // TripJack's cancel response carries the authoritative post-penalty refund.
    if (cancelChargesInfo && Number.isFinite(Number(result?.data?.refundAmount))) {
      const apiPrice = round2(booking.netAmount ?? booking.totalAmount ?? 0);
      cancelChargesInfo.refundAmount = round2(
        Math.min(Number(result.data.refundAmount), apiPrice),
      );
    }

    // 3. Record the breakdown, then settle the customer refund.
    booking.cancelCharge = cancelChargesInfo?.applicableCharge ?? undefined;
    booking.cancelChargesInfo = cancelChargesInfo;
    booking.cancellationDetails = cancelChargesInfo?.cancellation;
    await booking.save();

    if (process.env.ENABLE_AUTO_REFUNDS === "false") {
      booking.status = CabBookingStatus.CANCELLED;
      await booking.save();
      console.log(
        `[AmendmentService] ${payload.bookingId} CANCELLED; auto-refund disabled — pending manual refund.`,
      );
    } else {
      await refundService.settleCancellation(booking, cancelChargesInfo);
    }

    return result;
  }
}

export const amendmentService = new AmendmentService();
