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
import { ensureLocationAddress } from "../utils/location.utils";
import { deriveRegion } from "../utils/region.util";
import { calculateCabPrice } from "../utils/pricing.util";
import { resolveMarkupRules } from "../utils/wallet.util";
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
  token: string;
  clientType: ClientType;
  agentId?: string | null;
  agentName?: string | null;
  userInfo?: { id?: string; email?: string; phone?: string; role?: string; clientType?: string };
}

class BookingService {
  private getAgentDetail(payload: any, ctx: BookingContext) {
    // TripJack's payment API debits the account named at booking time: the
    // booking's agentId and the payment's payUserId must BOTH be our API-key
    // owner's agency id, or /cabs/v1/payment/create rejects with
    // "Access Denied" (code 408) and the booking dies unpaid. Never use a
    // client-supplied or Klar-internal agent id for the supplier payload.
    return {
      agentId: Number(env.tripJack.agencyId),
      agentEmail: String(
        payload.agentEmail || ctx.userInfo?.email || payload.passengerDetail?.email || "support@klar.com",
      ),
      agentPhone: String(
        payload.agentPhone || ctx.userInfo?.phone || payload.passengerDetail?.phone || "+911234567890",
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

    // ── 2. Build the supplier payload against the FRESH quote ids. The origin/
    //       destination addresses are resolved dynamically (TripJack location
    //       APIs) when the frontend only sent {displayAddress, lat, long}.
    const [bookOrigin, bookDestination] = await Promise.all([
      ensureLocationAddress(payload.routeDetail?.origin),
      ensureLocationAddress(payload.routeDetail?.destination),
    ]);
    const routeDetail = {
      ...payload.routeDetail,
      origin: bookOrigin,
      destination: bookDestination,
    };

    // ── 2a. Price the journey SERVER-SIDE.
    //
    // The region comes from the resolved pickup address, which ensureLocationAddress
    // guarantees carries {city, country} — never from anything the caller sent.
    const region = deriveRegion(bookOrigin?.address?.country);
    const markupRules = await resolveMarkupRules(clientType, ctx.token, region);
    const price = calculateCabPrice({
      supplierNet: validatedPrice,
      clientType,
      agentRules: markupRules,
      region,
    });
    console.log(
      `[BookingService] Priced region=${price.region} net=${price.supplierNet} ` +
        `platform=${price.platformMarkup} channel=${price.channelMarkup} gross=${price.gross}`,
    );

    // Supplier-side pricing must mirror the FRESH quote exactly: TripJack rejects
    // the booking ("Expected net amount is X") when netAmount differs from the
    // live quote's fare, and any drift between search and book breaks it. The
    // client-sent gross is still what we CHARGE the customer (see below); only
    // the supplier payload is rebuilt from the precheck.
    const freshFare = round2(Number(fresh.price || 0));
    const freshTax = round2(Number(fresh.taxes || 0));
    // Klar's total margin, computed above. Was `payload.pricingInfo.agentMarkup`
    // — a client-supplied number, which meant the caller chose our margin.
    const agentMarkupNum = price.markupAmount;
    const pricingInfo = {
      netAmount: freshFare.toFixed(2),
      addonsPrice: String(payload.pricingInfo?.addonsPrice || "0.00"),
      tjTaxAmount: freshTax.toFixed(2),
      tjManagementFee: String(payload.pricingInfo?.tjManagementFee || "0.00"),
      agentMarkup: agentMarkupNum,
      agentMarkupSplitup: {
        onwardJourneyMarkup: Number(payload.pricingInfo?.agentMarkupSplitup?.onwardJourneyMarkup || 0),
        returnJourneyMarkup: Number(payload.pricingInfo?.agentMarkupSplitup?.returnJourneyMarkup || 0),
      },
      grossAmount: round2(freshFare + freshTax + agentMarkupNum).toFixed(2),
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
      agentId: agent.agentId,
      agentEmail: String(payload.agentEmail || agent.agentEmail),
      agentPhone: String(payload.agentPhone || agent.agentPhone),
      consent: String(payload.consent || "yes"),
      vendorId: Number(payload.vendorId || quotationInfo.vendorId),
      correlationId,
    };

    // Klar-side amount the customer pays. Computed from the fresh supplier fare
    // plus the master's and the agent's configured rules — NOT from the request
    // body.
    //
    // The client's number is only compared. ValidationEngine rejects a supplier
    // price INCREASE beyond tolerance but has nothing to say about a gross that
    // is too LOW, so trusting `pricingInfo.grossAmount` let a caller send the
    // bare supplier net and pay no margin at all.
    const grossAmount = price.gross;
    const netAmount = price.supplierNet; // supplier owed (fresh total)
    const markupAmount = price.markupAmount;

    const clientGross = round2(
      Number(payload.pricingInfo?.grossAmount || payload.pricingInfo?.netAmount || 0),
    );
    if (clientGross > 0 && Math.abs(clientGross - grossAmount) > 0.01) {
      // Not fatal — the quote may simply be stale — but it means the customer
      // saw a different number than we are charging, so make it greppable.
      console.warn(
        `[BookingService] QUOTE MISMATCH quoted=${clientGross} charged=${grossAmount} ` +
          `region=${price.region} idempotencyKey=${idempotencyKey}`,
      );
    }

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
        // Pay the supplier the NET we owe them (fresh validated fare), not the
        // customer-facing GROSS — the platform/agent markup is Klar's margin and
        // must not be handed to TripJack.
        supplierAmount: netAmount,
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
    } else if (status === CabBookingStatus.FAILED) {
      throw new StructuredError(
        "SUPPLIER_ERROR",
        "Booking was rejected by the cab vendor/supplier. Razorpay payment will be refunded within 3-5 working days.",
        response
      );
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

    const generateKlarBookingId = (): string => {
      const date = new Date();
      const yy = String(date.getFullYear()).slice(-2);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let randomChars = "";
      for (let i = 0; i < 7; i++) {
        randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Assuming TripJack is the only provider for cabs right now ("T")
      return `KLCT${yy}${mm}${dd}${randomChars}`;
    };

    const bookingPayload = {
      ...base,
      klarBookingId: generateKlarBookingId(),
    };

    try {
      return await cabBookingRepository.createBooking(bookingPayload);
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
        if (prior) {
          // FAILED prior — reuse to retry, but reset the state: finalizeBookingRecord
          // refuses to overwrite FAILED, so a stale FAILED status would mask the
          // retry's real outcome (seen 2026-07-16: a booking that committed at the
          // supplier stayed FAILED with the first attempt's failureReason).
          prior.status = CabBookingStatus.INITIATED;
          prior.failureReason = undefined;
          await prior.save();
          return prior;
        }
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

    // Klar must always collect at least the supplier net it now settles (see
    // settleSupplier). Charging the raw client-supplied gross let a tampered/buggy
    // `gross < net` collect less than we pay TripJack — a direct Klar loss. Floor
    // the collected amount at the net for BOTH channels.
    const chargeAmount = round2(Math.max(Number(grossAmount) || 0, Number(netAmount) || 0));

    if (chargeAmount <= 0) {
      bookingDoc.paymentMethod = PaymentMethod.NONE;
      await bookingDoc.save();
      return PaymentMethod.NONE;
    }

    if (clientType === ClientType.B2B) {
      const { hasBalance } = await WalletUtil.checkInternalBalance(token!, chargeAmount);
      if (!hasBalance) {
        await this.markFailed(bookingDoc, "Insufficient wallet balance");
        throw new StructuredError("INSUFFICIENT_BALANCE", "Insufficient balance in internal Klar Wallet.");
      }
      const deducted = await WalletUtil.deductBalance(token!, chargeAmount, quoteId, `Cabs Booking - ${routeSummary}`);
      if (!deducted) {
        await this.markFailed(bookingDoc, "Wallet deduction failed");
        throw new StructuredError("WALLET_ERROR", "Wallet deduction failed.");
      }
      bookingDoc.paymentMethod = PaymentMethod.WALLET;
      await bookingDoc.save();
      console.log(`✅ [BookingService] Debited ₹${chargeAmount} from agent Klar wallet.`);
      return PaymentMethod.WALLET;
    }

    // B2C / GUEST: verify Razorpay SERVER-SIDE. Must cover the gross AND the net
    // we owe the supplier (a tampered-low gross can never book).
    const requiredAmount = chargeAmount;
    // Guard against a stale/reused payment id backing a second booking.
    await this.assertPaymentNotReused(payload.razorpayPaymentId, bookingDoc.idempotencyKey);
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
    supplierAmount: number;
    agentId: number;
    response: any;
    bookingDoc: ICabBooking;
  }): Promise<CabBookingStatus> {
    const { bookingId, supplierAmount, agentId, response, bookingDoc } = args;
    const supplier = cabSupplierRegistry.getByCode("TJ");

    if (supplierAmount <= 0) {
      if (response?.data) {
        response.data.status = "CONFIRMED";
        response.data.paymentStatus = "SUCCESS";
      }
      return CabBookingStatus.CONFIRMED;
    }

    try {
      // TripJack payment settles the agency's TripJack credit account (Klar↔TripJack);
      // independent of how the customer paid Klar, so it runs for every clientType.
      // The amount is the supplier NET (what TripJack quoted), never Klar's gross.
      const paymentResponse = await tripJackCabsProvider.createPayment({
        bookingId,
        amount: supplierAmount,
        paymentMedium: "WALLET",
        opType: "DEBIT",
        product: "CAB",
        transactionType: "PAID_FOR_ORDER",
        payUserId: env.tripJack.agencyId,
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
          // UAT reports a paid booking as "SUCCESS"; live/doc show "CONFIRMED"/"PAYMENT_SUCCESS".
          if (finalStatus === "CONFIRMED" || finalStatus === "SUCCESS" || finalStatus === "FAILED") break;
        } catch (pollErr: any) {
          console.warn(`⚠️ [BookingService] Poll ${attempt} failed:`, pollErr?.message || pollErr);
        }
      }

      if (finalStatus === "CONFIRMED" || finalStatus === "PAYMENT_SUCCESS" || finalStatus === "SUCCESS") {
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

  /**
   * A captured Razorpay payment must back exactly one booking. Reject a paymentId
   * already attached to a *different* booking (different idempotencyKey) so a
   * stale/reused id from the client can never pay for a second ride. Retries of
   * the same booking (same idempotencyKey) are allowed.
   */
  private async assertPaymentNotReused(paymentId?: string, idempotencyKey?: string): Promise<void> {
    if (!paymentId) return;
    const query: any = {
      razorpayPaymentId: paymentId,
      status: { $nin: [CabBookingStatus.FAILED, CabBookingStatus.CANCELLED] },
    };
    if (idempotencyKey) query.idempotencyKey = { $ne: idempotencyKey };
    const prior = await CabBookingModel.findOne(query);
    if (prior) {
      throw new StructuredError(
        "PAYMENT_ALREADY_USED",
        "This payment has already been used for another booking. If you were charged again it will be refunded automatically.",
      );
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
