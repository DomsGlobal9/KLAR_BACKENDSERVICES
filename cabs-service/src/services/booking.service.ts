import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { BookingRequest } from "../models/tripjack.types";
import { env } from "../config/env";
import {
  CabBookingModel,
  CabBookingStatus,
  ClientType,
  PaymentMethod,
  ICabBooking,
} from "../models/CabBooking.model";
import { cabBookingRepository } from "../repositories/cabBooking.repository";
import { getCityFromAddress, getCountryFromAddress } from "../utils/location.utils";
import { WalletUtil } from "../utils/wallet.util";
import { PaymentUtil } from "../utils/payment.util";
import { notificationService } from "./notification.service";
import { refundService } from "./refund.service";
import { precheckService } from "./precheck.service";
import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { cabSupplierRegistry } from "../suppliers/registry";
import { RedisLockUtil } from "./RedisLockUtil";
import { StructuredError } from "./StructuredError";

/** Statuses that mean "this booking already exists — don't re-run it". */
const IDEMPOTENT_RETURN_STATUSES = new Set<CabBookingStatus>([
  CabBookingStatus.CONFIRMED,
  CabBookingStatus.PENDING,
  CabBookingStatus.SUPPLIER_PENDING,
  CabBookingStatus.CANCELLED,
  CabBookingStatus.REFUNDED,
]);

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Who is booking and how — assembled by the controller from auth + headers. */
export interface BookingContext {
  token?: string;
  clientType: ClientType;
  agentId?: string | null;
  agentName?: string | null;
  userInfo?: { id?: string; email?: string; role?: string; clientType?: string };
}

class BookingService {
  private getAgentDetail(payload: any, ctx: BookingContext) {
    return {
      agentId: Number(payload.agentId || ctx.agentId || env.tripJack.agencyId || 312879),
      agentEmail: String(
        payload.agentEmail || ctx.userInfo?.email || payload.passengerDetail?.email || "support@klar.com",
      ),
      agentPhone: String(
        payload.agentPhone || payload.passengerDetail?.phone || "+911234567890",
      ),
    };
  }

  /**
   * Deterministic fingerprint of a booking attempt. Two identical requests hash
   * to the same key, so the UNIQUE index on CabBooking.idempotencyKey guarantees
   * at most one booking + one charge.
   */
  private buildIdempotencyKey(payload: any, actor: string): string {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          actor,
          quoteId: payload.quotationInfo?.quoteId || payload.quotationInfo?.childQuoteId,
          pickup: payload.journeyInfo?.pickupDateTime,
          vehicle: payload.quotationInfo?.vehicleType,
          gross: payload.pricingInfo?.grossAmount,
          passenger: payload.passengerDetail?.email,
          // client-supplied key (idempotency-key header) takes precedence upstream
          explicit: payload.idempotencyKey || "",
        }),
      )
      .digest("hex");
  }

  async book(payload: any, ctx: BookingContext) {
    const clientType = ctx.clientType || ClientType.B2C;

    // B2B must be an authenticated agent (wallet debit needs the token).
    if (clientType === ClientType.B2B && !ctx.token) {
      throw new StructuredError(
        "UNAUTHORIZED",
        "Authentication token is required for B2B booking.",
      );
    }

    if (!payload.journeyInfo || !payload.passengerDetail) {
      throw new StructuredError("VALIDATION_ERROR", "Missing journeyInfo or passengerDetail.");
    }
    if (!payload.quotationInfo?.quoteId && !payload.quotationInfo?.childQuoteId) {
      throw new StructuredError(
        "VALIDATION_ERROR",
        "quotationInfo.quoteId (or childQuoteId) is required for booking.",
      );
    }

    // B2C/GUEST must present a Razorpay payment to verify server-side.
    if (clientType !== ClientType.B2B && !payload.razorpayPaymentId) {
      throw new StructuredError(
        "VALIDATION_ERROR",
        "razorpayPaymentId is required for B2C/guest booking.",
      );
    }

    const correlationId = payload.correlationId || uuidv4();
    const actor = String(
      clientType === ClientType.B2B
        ? ctx.agentId || "agent"
        : ctx.userInfo?.id || payload.userId || payload.passengerDetail?.email || "guest",
    );
    const idempotencyKey = this.buildIdempotencyKey(payload, actor);
    const lockKey = `cab:book:${idempotencyKey}`;

    return RedisLockUtil.executeWithLock(lockKey, correlationId, () =>
      this.executeBooking(payload, { ...ctx, clientType }, { correlationId, actor, idempotencyKey }),
    );
  }

  private async executeBooking(
    payload: any,
    ctx: BookingContext,
    meta: { correlationId: string; actor: string; idempotencyKey: string },
  ) {
    const { correlationId, actor, idempotencyKey } = meta;
    const clientType = ctx.clientType;

    // Idempotent replay.
    const existing = await CabBookingModel.findOne({ idempotencyKey });
    if (existing && IDEMPOTENT_RETURN_STATUSES.has(existing.status)) {
      console.log(`[BookingService] Idempotent replay for ${idempotencyKey} -> ${existing.status}`);
      return (
        existing.tripJackResponse || {
          success: true,
          message: "Booking already processed.",
          data: { id: existing.bookingId, status: existing.status },
        }
      );
    }

    // ── 1. Re-price against a live quote (PRICE_CHANGED / VEHICLE_CHANGED / SOLD_OUT).
    const { fresh, validatedPrice } = await precheckService.run(payload);
    console.log(
      `[BookingService] Precheck OK. clientType=${clientType} freshTotal=${validatedPrice} ` +
        `quotationId=${fresh.quotationId} vehicle=${fresh.vehicleType}/${fresh.vehicleCategory}`,
    );

    const agent = this.getAgentDetail(payload, ctx);

    // ── 2. Build the supplier payload against the FRESH quote ids.
    const routeDetail = {
      ...payload.routeDetail,
      origin: {
        ...payload.routeDetail?.origin,
        type: "location",
        address:
          payload.routeDetail?.origin?.address || {
            city: getCityFromAddress(payload.routeDetail?.origin?.displayAddress),
            country: getCountryFromAddress(payload.routeDetail?.origin?.displayAddress),
          },
      },
      destination: {
        ...payload.routeDetail?.destination,
        type: "location",
        address:
          payload.routeDetail?.destination?.address || {
            city: getCityFromAddress(payload.routeDetail?.destination?.displayAddress),
            country: getCountryFromAddress(payload.routeDetail?.destination?.displayAddress),
          },
      },
    };

    const pricingInfo = {
      netAmount: String(payload.pricingInfo?.netAmount || "0.00"),
      addonsPrice: String(payload.pricingInfo?.addonsPrice || "0.00"),
      tjTaxAmount: String(payload.pricingInfo?.tjTaxAmount || "0.00"),
      tjManagementFee: String(payload.pricingInfo?.tjManagementFee || "0.00"),
      agentMarkup: Number(payload.pricingInfo?.agentMarkup || 0),
      agentMarkupSplitup: {
        onwardJourneyMarkup: Number(payload.pricingInfo?.agentMarkupSplitup?.onwardJourneyMarkup || 0),
        returnJourneyMarkup: Number(payload.pricingInfo?.agentMarkupSplitup?.returnJourneyMarkup || 0),
      },
      grossAmount: String(payload.pricingInfo?.grossAmount || payload.pricingInfo?.netAmount || "0.00"),
    };

    const quotationInfo = {
      vehicleType: String(payload.quotationInfo?.vehicleType || fresh.vehicleType),
      vehicleCategory: String(payload.quotationInfo?.vehicleCategory || fresh.vehicleCategory),
      quoteId: String(fresh.quotationId || payload.quotationInfo?.quoteId || payload.quotationInfo?.childQuoteId || ""),
      childQuoteId: String(fresh.quoteChildId || payload.quotationInfo?.childQuoteId || payload.quotationInfo?.quoteId || ""),
      paxCount: Number(payload.quotationInfo?.paxCount || fresh.paxCount || 1),
      luggageCount: Number(payload.quotationInfo?.luggageCount || fresh.luggageCount || 2),
      vendorId: Number(fresh.vendorId || payload.quotationInfo?.vendorId || payload.vendorId || 1),
    };

    const passengerDetail = {
      firstName: String(payload.passengerDetail?.firstName || "Traveler"),
      lastName: String(payload.passengerDetail?.lastName || "Name"),
      email: String(payload.passengerDetail?.email || ""),
      phone: String(payload.passengerDetail?.phone || ""),
      ...(payload.passengerDetail?.flightDetails
        ? { flightDetails: payload.passengerDetail.flightDetails }
        : {}),
    };

    const journeyInfo = {
      ...payload.journeyInfo,
      distance: String(payload.journeyInfo?.distance || "10 Km"),
      duration: Number(payload.journeyInfo?.duration || 30),
    };

    const finalPayload: BookingRequest = {
      ...payload,
      journeyInfo,
      routeDetail,
      quotationInfo,
      pricingInfo,
      passengerDetail,
      addons: Array.isArray(payload.addons) ? payload.addons : [],
      serviceRequest: String(payload.serviceRequest || ""),
      agentId: Number(payload.agentId || agent.agentId),
      agentEmail: String(payload.agentEmail || agent.agentEmail),
      agentPhone: String(payload.agentPhone || agent.agentPhone),
      consent: String(payload.consent || "yes"),
      vendorId: Number(payload.vendorId || quotationInfo.vendorId),
      correlationId,
    };

    // Klar-side amount the customer pays = GROSS (includes markup).
    const grossAmount = round2(Number(pricingInfo.grossAmount || 0));
    const netAmount = round2(validatedPrice); // supplier owed (fresh total)
    const markupAmount = grossAmount > netAmount ? round2(grossAmount - netAmount) : 0;

    // ── 3. Claim the idempotency slot with an INITIATED record BEFORE any charge.
    const bookingDoc = await this.claimBookingRecord({
      idempotencyKey,
      correlationId,
      actor,
      ctx,
      payload,
      grossAmount,
      netAmount,
      markupAmount,
    });

    // ── 4. Collect payment on the Klar side (channel-specific). Sets the rail
    //       (WALLET/GATEWAY) on the record so RefundService can refund it later.
    await this.collectPayment({
      clientType,
      token: ctx.token,
      payload,
      bookingDoc,
      grossAmount,
      netAmount,
      quoteId: quotationInfo.quoteId,
      routeSummary: `${payload.routeDetail?.origin?.displayAddress} to ${payload.routeDetail?.destination?.displayAddress}`,
    });

    // ── 5. Commit at the supplier.
    const supplier = cabSupplierRegistry.getByCode("TJ");
    if (!supplier?.adapter.commit) {
      await refundService.refundFailedBooking(bookingDoc, "No supplier available");
      throw new StructuredError("SUPPLIER_ERROR", "No cab supplier is registered.");
    }

    let response: any;
    try {
      response = await supplier.adapter.commit(finalPayload);
    } catch (err: any) {
      await refundService.refundFailedBooking(bookingDoc, err?.message || "Supplier booking failed");
      throw err;
    }

    const bookingId = response?.data?.id || response?.data?.bookingId;

    // ── 6. Settle the supplier (TripJack payment API) + poll for a terminal status.
    let status = CabBookingStatus.PENDING;
    if (bookingId) {
      status = await this.settleSupplier({
        bookingId,
        grossAmount,
        agentId: agent.agentId,
        response,
        bookingDoc,
      });
    } else {
      await refundService.refundFailedBooking(bookingDoc, "Supplier returned no booking id");
      status = CabBookingStatus.FAILED;
    }

    // ── 7. Persist final state.
    await this.finalizeBookingRecord(bookingDoc, { bookingId, status, finalPayload, response });

    if (status === CabBookingStatus.CONFIRMED) {
      const saved = await CabBookingModel.findById(bookingDoc._id);
      if (saved) notificationService.sendBookingConfirmation(saved);
    }

    return response;
  }

  /** Create (or reuse) the INITIATED booking record. */
  private async claimBookingRecord(args: {
    idempotencyKey: string;
    correlationId: string;
    actor: string;
    ctx: BookingContext;
    payload: any;
    grossAmount: number;
    netAmount: number;
    markupAmount: number;
  }): Promise<ICabBooking> {
    const { idempotencyKey, correlationId, actor, ctx, payload, grossAmount, netAmount, markupAmount } = args;
    const isB2B = ctx.clientType === ClientType.B2B;

    const base = {
      idempotencyKey,
      correlationId,
      clientType: ctx.clientType,
      agentId: isB2B ? String(ctx.agentId || actor) : undefined,
      agentName: isB2B ? ctx.agentName || undefined : undefined,
      userId: isB2B ? undefined : String(ctx.userInfo?.id || payload.userId || actor),
      userInfo: ctx.userInfo,
      status: CabBookingStatus.INITIATED,
      priceValidated: true,
      validatedAmount: netAmount,
      netAmount,
      markupAmount,
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      pickupDate: new Date(payload.journeyInfo?.pickupDateTime || payload.journeyInfo?.pickupDate || Date.now()),
      origin: {
        displayAddress: payload.routeDetail?.origin?.displayAddress || "Unknown",
        lat: String(payload.routeDetail?.origin?.lat || "0"),
        long: String(payload.routeDetail?.origin?.long || "0"),
      },
      destination: {
        displayAddress: payload.routeDetail?.destination?.displayAddress || "Unknown",
        lat: String(payload.routeDetail?.destination?.lat || "0"),
        long: String(payload.routeDetail?.destination?.long || "0"),
      },
      vehicleType: payload.quotationInfo?.vehicleType || "Unknown",
      vehicleCategory: payload.quotationInfo?.vehicleCategory || "Unknown",
      totalAmount: grossAmount,
      currency: "INR",
      passenger: {
        firstName: payload.passengerDetail.firstName,
        lastName: payload.passengerDetail.lastName,
        email: payload.passengerDetail.email,
        phone: payload.passengerDetail.phone,
      },
    };

    try {
      return await cabBookingRepository.createBooking(base);
    } catch (err: any) {
      if (err?.code === 11000) {
        const prior = await CabBookingModel.findOne({ idempotencyKey });
        if (prior && IDEMPOTENT_RETURN_STATUSES.has(prior.status)) return prior;
        if (prior && prior.status === CabBookingStatus.INITIATED) {
          throw new StructuredError(
            "DUPLICATE_REQUEST",
            "This booking is already being processed. Please wait.",
          );
        }
        if (prior) return prior; // FAILED prior — reuse to retry
      }
      throw err;
    }
  }

  /**
   * Collect the customer's payment on the Klar side:
   *  • B2B   -> debit the agent Klar wallet (server-side).
   *  • B2C/GUEST -> verify the Razorpay payment server-side (fail closed).
   * Returns how they paid, so failures refund on the right rail.
   */
  private async collectPayment(args: {
    clientType: ClientType;
    token?: string;
    payload: any;
    bookingDoc: ICabBooking;
    grossAmount: number;
    netAmount: number;
    quoteId: string;
    routeSummary: string;
  }): Promise<PaymentMethod> {
    const { clientType, token, payload, bookingDoc, grossAmount, netAmount, quoteId, routeSummary } = args;

    if (grossAmount <= 0) {
      bookingDoc.paymentMethod = PaymentMethod.NONE;
      await bookingDoc.save();
      return PaymentMethod.NONE;
    }

    if (clientType === ClientType.B2B) {
      const { hasBalance } = await WalletUtil.checkInternalBalance(token!, grossAmount);
      if (!hasBalance) {
        await this.markFailed(bookingDoc, "Insufficient wallet balance");
        throw new StructuredError("INSUFFICIENT_BALANCE", "Insufficient balance in internal Klar Wallet.");
      }
      const deducted = await WalletUtil.deductBalance(token!, grossAmount, quoteId, `Cabs Booking - ${routeSummary}`);
      if (!deducted) {
        await this.markFailed(bookingDoc, "Wallet deduction failed");
        throw new StructuredError("WALLET_ERROR", "Wallet deduction failed.");
      }
      bookingDoc.paymentMethod = PaymentMethod.WALLET;
      await bookingDoc.save();
      console.log(`✅ [BookingService] Debited ₹${grossAmount} from agent Klar wallet.`);
      return PaymentMethod.WALLET;
    }

    // B2C / GUEST: verify Razorpay SERVER-SIDE. Must cover the gross AND the net
    // we owe the supplier (a tampered-low gross can never book).
    const requiredAmount = round2(Math.max(grossAmount, netAmount));
    const pay = await PaymentUtil.verifyRazorpayPayment({
      paymentId: payload.razorpayPaymentId,
      orderId: payload.razorpayOrderId,
      expectedAmount: requiredAmount,
      platform: "B2C",
    });
    if (!pay.verified) {
      await this.markFailed(bookingDoc, `Payment unverified: ${pay.reason || "unknown"}`);
      throw new StructuredError(
        "PAYMENT_UNVERIFIED",
        "We could not verify your payment. If any amount was debited it will be refunded automatically.",
        { reason: pay.reason },
      );
    }
    bookingDoc.paymentMethod = PaymentMethod.GATEWAY;
    await bookingDoc.save();
    console.log(`✅ [BookingService] Verified Razorpay payment ₹${pay.capturedAmount} (required ₹${requiredAmount}).`);
    return PaymentMethod.GATEWAY;
  }

  /** Settle TripJack (payment API) and poll for a terminal status. */
  private async settleSupplier(args: {
    bookingId: string;
    grossAmount: number;
    agentId: number;
    response: any;
    bookingDoc: ICabBooking;
  }): Promise<CabBookingStatus> {
    const { bookingId, grossAmount, agentId, response, bookingDoc } = args;
    const supplier = cabSupplierRegistry.getByCode("TJ");

    if (grossAmount <= 0) {
      if (response?.data) {
        response.data.status = "CONFIRMED";
        response.data.paymentStatus = "SUCCESS";
      }
      return CabBookingStatus.CONFIRMED;
    }

    try {
      // TripJack payment settles the agency's TripJack credit account (Klar↔TripJack);
      // independent of how the customer paid Klar, so it runs for every clientType.
      const paymentResponse = await tripJackCabsProvider.createPayment({
        bookingId,
        amount: grossAmount,
        paymentMedium: "WALLET",
        opType: "DEBIT",
        product: "CAB",
        transactionType: "PAID_FOR_ORDER",
        payUserId: String(agentId),
      });

      const paymentOk = paymentResponse?.success || paymentResponse?.data?.[0]?.status === "SUCCESS";
      if (!paymentOk) {
        console.warn(`⚠️ [BookingService] TripJack payment pending/failed for ${bookingId}.`);
        return CabBookingStatus.SUPPLIER_PENDING;
      }

      let finalStatus: string | undefined;
      let finalPaymentStatus: string | undefined;
      for (let attempt = 1; attempt <= 4; attempt++) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const detailsRes = await supplier?.adapter.pollStatus?.(bookingId);
          finalStatus = detailsRes?.data?.[0]?.order?.status;
          finalPaymentStatus = detailsRes?.data?.[0]?.order?.paymentStatus;
          console.log(`[BookingService] Poll ${attempt}/4 - status=${finalStatus} paymentStatus=${finalPaymentStatus}`);
          if (finalStatus === "CONFIRMED" || finalStatus === "FAILED") break;
        } catch (pollErr: any) {
          console.warn(`⚠️ [BookingService] Poll ${attempt} failed:`, pollErr?.message || pollErr);
        }
      }

      if (finalStatus === "CONFIRMED" || finalStatus === "PAYMENT_SUCCESS") {
        if (response?.data) {
          response.data.status = "CONFIRMED";
          response.data.paymentStatus = "SUCCESS";
        }
        return CabBookingStatus.CONFIRMED;
      }

      if (finalStatus === "FAILED") {
        if (response?.data) {
          response.data.status = "FAILED";
          response.data.paymentStatus = finalPaymentStatus || "REFUND_SUCCESS";
        }
        await refundService.refundFailedBooking(bookingDoc, "Supplier failed the booking after payment");
        return CabBookingStatus.FAILED;
      }

      // Still processing — leave for the reconciliation worker.
      if (response?.data) {
        response.data.status = "SUPPLIER_PENDING";
        response.data.paymentStatus = "PROCESSING";
      }
      return CabBookingStatus.SUPPLIER_PENDING;
    } catch (payError: any) {
      console.error("❌ [BookingService] TripJack payment error:", payError?.message);
      return CabBookingStatus.SUPPLIER_PENDING;
    }
  }

  private async finalizeBookingRecord(
    doc: ICabBooking,
    args: { bookingId?: string; status: CabBookingStatus; finalPayload: BookingRequest; response: any },
  ) {
    try {
      doc.bookingId = args.bookingId;
      // Don't overwrite a refund/failed state reached during settlement.
      if (doc.status !== CabBookingStatus.FAILED && doc.status !== CabBookingStatus.REFUNDED) {
        doc.status = args.status;
      }
      doc.tripJackRequest = args.finalPayload;
      doc.tripJackResponse = args.response;
      await doc.save();
      console.log(`✅ [BookingService] Saved booking ${args.bookingId} as ${doc.status}.`);
    } catch (dbErr) {
      console.error("❌ [BookingService] Failed to persist booking:", dbErr);
    }
  }

  private async markFailed(doc: ICabBooking, reason: string) {
    try {
      doc.status = CabBookingStatus.FAILED;
      doc.failureReason = reason;
      await doc.save();
    } catch (e) {
      console.error("[BookingService] markFailed persist error:", e);
    }
  }
}

export const bookingService = new BookingService();
