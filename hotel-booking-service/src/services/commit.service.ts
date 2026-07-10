import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { tripJackAdapter } from "../adapters/tripjack.adapter";
import { rateGainAdapter } from "../adapters/rategain.adapter";
import { ValidationEngine, StructuredError } from "./ValidationEngine";
import { BookingStatus, BookingProvider, IUserInfo } from "../models/Booking.model";
import { BookingEventLogger } from "../models/BookingEvent";
import { RedisLockUtil } from "./RedisLockUtil";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { notificationService } from "./notification.service";
import { refundService } from "./refund.service";
import { refundService } from "./refund.service";
import { WalletUtil, MarkupRule } from "../utils/wallet.util";
import { PricingUtil, round2 } from "../utils/pricing.util";

// ─── Async Polling Helpers ──────────────────────────────────────────────────

// TripJack Book is ASYNC: confirmation can take up to 180s. Per the v3 spec we
// poll Booking Details every 5s until a terminal status or the 180s window elapses.
const POLL_INTERVAL_MS = 5000; // spec: poll every 5 seconds
const MAX_POLL_ATTEMPTS = 36; // 36 × 5s = 180s (TripJack's async confirmation window)
// Terminal-success: SUCCESS, ON_HOLD (per spec Booking Status table). "CONFIRMED" kept defensively.
const TJ_SUCCESS_STATUSES = new Set(["SUCCESS", "ON_HOLD", "CONFIRMED"]);
// Terminal-failure: ABORTED, FAILED (no charge). CANCELLED handled by cancel flow.
const TJ_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "CANCELLED"]);
// Non-terminal pending states we keep polling through.
const TJ_PENDING_STATUSES = new Set([
  "PAYMENT_SUCCESS",
  "PAYMENT_PENDING",
  "PENDING",
  "IN_PROGRESS",
  "CANCELLATION_PENDING",
]);

async function pollTripJackBookingStatus(
  tjBookingId: string,
  dbBookingId: string,
  attempt: number = 1,
): Promise<void> {
  const maxAttempts = MAX_POLL_ATTEMPTS; // 36 × 5s = 180s (TripJack async window)

  if (attempt > maxAttempts) {
    console.log(
      `[TripJack] Polling timeout reached for ${tjBookingId}. Escalating to MANUAL_REVIEW.`,
    );
    try {
      const details = await tripJackProvider.getBookingDetails(tjBookingId);
      // Only park it if the status cron hasn't already resolved the booking —
      // otherwise we'd drag a CONFIRMED booking back into MANUAL_REVIEW.
      await hotelBookingRepository.findOneAndUpdate(
        {
          _id: dbBookingId,
          status: {
            $nin: [
              BookingStatus.CONFIRMED,
              BookingStatus.HELD,
              BookingStatus.CANCELLED,
              BookingStatus.FAILED,
            ],
          },
        },
        { status: BookingStatus.MANUAL_REVIEW, tripJackResponse: details },
      );
      // Only park it if the status cron hasn't already resolved the booking —
      // otherwise we'd drag a CONFIRMED booking back into MANUAL_REVIEW.
      await hotelBookingRepository.findOneAndUpdate(
        {
          _id: dbBookingId,
          status: {
            $nin: [
              BookingStatus.CONFIRMED,
              BookingStatus.HELD,
              BookingStatus.CANCELLED,
              BookingStatus.FAILED,
            ],
          },
        },
        { status: BookingStatus.MANUAL_REVIEW, tripJackResponse: details },
      );
      await BookingEventLogger.log(
        tjBookingId,
        dbBookingId,
        "POLLING_TIMEOUT",
        { status: "MANUAL_REVIEW" },
      );
    } catch (e: any) {
      console.warn(
        `[TripJack] Failed to fetch final state on timeout for ${tjBookingId}:`,
        e.message,
      );
    }
    return;
  }

  try {
    const details = await tripJackProvider.getBookingDetails(tjBookingId);
    const apiSuccess = details?.status?.success === true;
    const tjStatus: string = details?.order?.status || "";

    const isSystemPending = details?.isSystemPending === true;
    // A success status is only truly terminal if the system is no longer pending.
    // Failure/cancellation statuses are always terminal.
    // A success status is only truly terminal if the system is no longer pending.
    // Failure/cancellation statuses are always terminal.
    const isTerminal =
      (!isSystemPending && TJ_SUCCESS_STATUSES.has(tjStatus)) ||
      TJ_FAILED_STATUSES.has(tjStatus);
      (!isSystemPending && TJ_SUCCESS_STATUSES.has(tjStatus)) ||
      TJ_FAILED_STATUSES.has(tjStatus);

    if (
      !isTerminal &&
      (isSystemPending || TJ_PENDING_STATUSES.has(tjStatus) || !tjStatus)
      !isTerminal &&
      (isSystemPending || TJ_PENDING_STATUSES.has(tjStatus) || !tjStatus)
    ) {
      const backoffDelay = POLL_INTERVAL_MS;
      console.log(
        `[TripJack] Status ${tjStatus || "UNKNOWN"}. Polling attempt ${attempt}/${maxAttempts}. Waiting ${backoffDelay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      return pollTripJackBookingStatus(tjBookingId, dbBookingId, attempt + 1);
    }

    if (apiSuccess && TJ_SUCCESS_STATUSES.has(tjStatus)) {
      const newStatus =
        tjStatus === "ON_HOLD" ? BookingStatus.HELD : BookingStatus.CONFIRMED;
      // Real hotel/PMS confirmation number (display); confirmationNumber stays the
      // TJ bookingId which cancel needs.
      const hotelConfirmationNumber =
        details?.hotelConfirmationNumber || undefined;
      // Conditional transition: if the status cron resolved this booking first,
      // `updated` is null and we skip the (duplicate) confirmation email.
      const updated = await hotelBookingRepository.transitionStatus(
      // Conditional transition: if the status cron resolved this booking first,
      // `updated` is null and we skip the (duplicate) confirmation email.
      const updated = await hotelBookingRepository.transitionStatus(
        dbBookingId,
        newStatus,
        newStatus,
        {
          tripJackResponse: details,
          ...(hotelConfirmationNumber ? { hotelConfirmationNumber } : {}),
        },
      );
      if (updated && newStatus === BookingStatus.CONFIRMED) {
        notificationService.sendBookingConfirmation(updated);
      }
      if (updated && newStatus === BookingStatus.CONFIRMED) {
        notificationService.sendBookingConfirmation(updated);
      }
      return;
    }

    if (TJ_FAILED_STATUSES.has(tjStatus)) {
      await hotelBookingRepository.findByIdAndUpdate(dbBookingId, {
        tripJackResponse: details,
      });

      // TripJack rejected the booking outright. Return the money now rather
      // than waiting on the 15-minute reconciliation sweep. refundFailedBooking
      // picks wallet vs Razorpay from the record and only closes the booking
      // out to FAILED once the refund lands.
      const booking = await hotelBookingRepository.findOne({ _id: dbBookingId });
      if (booking) {
        await refundService.refundFailedBooking(
          booking,
          `TripJack returned a terminal status of ${tjStatus}.`,
        );
      }

      // TripJack rejected the booking outright. Return the money now rather
      // than waiting on the 15-minute reconciliation sweep. refundFailedBooking
      // picks wallet vs Razorpay from the record and only closes the booking
      // out to FAILED once the refund lands.
      const booking = await hotelBookingRepository.findOne({ _id: dbBookingId });
      if (booking) {
        await refundService.refundFailedBooking(
          booking,
          `TripJack returned a terminal status of ${tjStatus}.`,
        );
      }
      return;
    }

    // Unrecognized status, backoff and retry
    const backoffDelay = POLL_INTERVAL_MS;
    await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    return pollTripJackBookingStatus(tjBookingId, dbBookingId, attempt + 1);
  } catch (err: any) {
    const backoffDelay = POLL_INTERVAL_MS;
    await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    return pollTripJackBookingStatus(tjBookingId, dbBookingId, attempt + 1);
  }
}

// ─── Commit Service ─────────────────────────────────────────────────────────

function extractHotelImage(imagePayload: any): string | undefined {
  if (!imagePayload) return undefined;
  if (typeof imagePayload === "string") return imagePayload;
  if (imagePayload.links?.original?.href)
    return imagePayload.links.original.href;
  if (imagePayload.url) return imagePayload.url;
  return undefined;
}

class CommitService {
  async commit(
    payload: any,
    agentId?: string | null,
    agentName?: string | null,
    token?: string,
    clientType: string = "B2C",
    requestId: string = "",
    userInfo?: IUserInfo,
  ) {
    const propertyId = (
      payload.propertyId ||
      payload.PropertyId ||
      payload.BookReservation?.propertyID ||
      ""
    ).toString();
    const tjBookingId = (
      payload.bookingId ||
      payload.ConfirmationNumber ||
      ""
    ).toString();

    const isTripJack =
      propertyId.startsWith("TJ") ||
      tjBookingId.startsWith("TJ") ||
      tjBookingId.startsWith("TG") ||
      payload.type === "HOTEL" ||
      (!payload.BookReservation && payload.bookingId);

    // Lock key specific to this unique booking attempt (combining hotel + dates + user or optionId)
    // A generic key like "lock_booking_agent1" prevents concurrent duplicates
    const lockKey = `commit_lock_${agentId || "guest"}_${payload.optionId || payload.bookingId || tjBookingId}`;

    return RedisLockUtil.executeWithLock(lockKey, requestId, async () => {
      if (isTripJack) {
        return this.#commitTripJack(
          payload,
          agentId,
          agentName,
          token,
          clientType,
          requestId,
          userInfo,
        );
      }
      return this.#commitRateGain(
        payload,
        agentId,
        agentName,
        token,
        clientType,
        requestId,
        userInfo,
      );
    });
  }

  async #commitTripJack(
    payload: any,
    agentId?: string | null,
    agentName?: string | null,
    token?: string,
    clientType: string = "B2C",
    requestId: string = "",
    userInfo?: IUserInfo,
  ) {
    if (clientType === "B2B" && !token)
      throw new Error("Authentication token is required for B2B booking.");

    console.log(
      `[TripJack] Starting Secure OTA Flow for Agent: ${agentId}, ClientType: ${clientType}, RequestId: ${requestId}`,
    );

    let bookingId = payload.bookingId;
    if (!bookingId) throw new Error("Booking ID is required from frontend.");

    let netPrice =
      payload.netPrice ||
      payload.paymentInfos?.[0]?.amount ||
      payload.amount ||
      payload.totalPrice ||
      0;
    if (netPrice <= 0)
      throw new Error("Invalid price returned from provider or payload.");

    console.log(`✅ [TripJack] Trusted Frontend Net Price: ₹${netPrice}`);

    let paymentProcessed = false;
    const demandBookingId = `TJ-BOOK-${Date.now()}`;
    let finalPrice = payload.sellingRate || payload.totalPrice || netPrice;
    let markup = 0;
    const isHoldIntent =
      payload.isHold === true || payload.holdBooking === true;

    try {
      // PHASE 1: Revalidate with Supplier Adapter & Validation Engine
      const tjPrecheckPayload = {
        correlationId: payload.correlationId,
        optionId: payload.optionId,
        reviewHash: payload.reviewHash,
        hid: payload.hid,
        propertyId: payload.propertyId,
      };

      const freshPrecheck = await tripJackAdapter.precheck(tjPrecheckPayload);
      const expectedResult = {
        roomType: payload.roomName || payload.roomType,
        mealPlan: payload.boardType,
        price: netPrice,
      };

      const validationResult = ValidationEngine.validate(
        expectedResult,
        freshPrecheck,
        { fixed: 10, percent: 0.5 },
      );

      await BookingEventLogger.log(bookingId, requestId, "PRECHECK_SUCCESS", {
        expectedResult,
        freshPrecheck,
      });

      if (validationResult.price < netPrice) {
        console.log(
          `📉 [TripJack] Price dropped from ₹${netPrice} to ₹${validationResult.price}. Passing savings to customer!`,
        );
        await BookingEventLogger.log(bookingId, requestId, "PRICE_DROPPED", {
          oldPrice: netPrice,
          newPrice: validationResult.price,
        });
        netPrice = validationResult.price;
      }

      // Update OptionId if changed
      if (
        freshPrecheck.optionId &&
        freshPrecheck.optionId !== payload.optionId
      ) {
        console.log(
          `🔄 [TripJack] OptionId remapped: ${payload.optionId} -> ${freshPrecheck.optionId}`,
        );
        payload.optionId = freshPrecheck.optionId;
      }

      // PHASE 2: Calculate Final Price & Markup
      if (clientType === "B2B") {
        const markupRules = await WalletUtil.getMarkupRules(token!);
        const pricing = PricingUtil.calculatePriceWithMarkup(
          netPrice,
          markupRules,
          payload.additionalMarkup,
          payload.couponCode,
        );
        finalPrice = pricing.total;
        markup = pricing.markup;
        console.log(
          `✅ [Klar] Final Calculated B2B Price: ₹${finalPrice} (Admin + Additional Markup: ₹${markup})`,
        );
      } else {
        finalPrice = round2(Number(finalPrice));
        markup = finalPrice > netPrice ? round2(finalPrice - netPrice) : 0;
        finalPrice = round2(Number(finalPrice));
        markup = finalPrice > netPrice ? round2(finalPrice - netPrice) : 0;
        console.log(
          `✅ [Klar] B2C Booking Price: ₹${finalPrice}, Markup: ₹${markup}`,
        );
      }

      // PHASE 3: Wallet Deduction (Atomic) - ONLY FOR B2B
      if (clientType === "B2B") {
        if (!isHoldIntent) {
          paymentProcessed = await WalletUtil.deductBalance(
            token!,
            finalPrice,
            demandBookingId,
            `Hotel Booking at ${payload.hotelName || "TripJack Hotel"}`,
          );
          if (!paymentProcessed)
            throw new StructuredError(
              "INSUFFICIENT_WALLET",
              "Wallet deduction failed. Please check your balance.",
            );
          await BookingEventLogger.log(bookingId, requestId, "WALLET_DEBITED", {
            amount: finalPrice,
          });
        } else {
          console.log(
            `⏸️ [TripJack] Hold Booking Requested — Deferring immediate internal wallet deduction.`,
          );
        }
      } else {
        // B2C Flow - Payment is already processed by Payment Gateway
        paymentProcessed = true;
      }

      // PHASE 4: Provider Booking (pay the supplier the RAW net — EXCLUDES platform markup)
      const supplierAmount = freshPrecheck.supplierNet ?? netPrice;
      const tjPayload = {
        bookingId,
        type: "HOTEL",
        roomTravellerInfo: payload.roomTravellerInfo,
        deliveryInfo: payload.deliveryInfo,
        ...(payload.gstInfo && { gstInfo: payload.gstInfo }),
        // Guaranteed positive net amount injection for instant confirmations; strict omission for holds
        paymentInfos: !isHoldIntent ? [{ amount: supplierAmount }] : undefined,
      };

      const tjResponse = await tripJackProvider.commit(tjPayload);

      await BookingEventLogger.log(bookingId, requestId, "SUPPLIER_COMMIT", {
        success: tjResponse.status,
      });

      if (!tjResponse.status) {
        console.error(
          `❌ [TripJack] Booking failed: ${tjResponse.description}`,
        );
        throw new Error(
          tjResponse.description || "Provider rejected the booking request.",
        );
      }

      // Build lean rooms array — one entry per room, no raw blobs.
      // Split the price the customer actually paid (finalPrice), matching the
      // RateGain path; splitting netPrice made room prices sum to less than
      // totalAmount on the voucher.
      // Build lean rooms array — one entry per room, no raw blobs.
      // Split the price the customer actually paid (finalPrice), matching the
      // RateGain path; splitting netPrice made room prices sum to less than
      // totalAmount on the voucher.
      const numRooms = (payload.roomTravellerInfo || []).length || 1;
      const pricePerRoom = round2(finalPrice / numRooms);
      const pricePerRoom = round2(finalPrice / numRooms);
      const rooms = (payload.roomTravellerInfo || [{}]).map((room: any) => ({
        roomType: payload.roomName || payload.roomType || "Standard Room",
        boardType: payload.boardType || "",
        guests: room.travellerInfo?.length || 2,
        price: pricePerRoom,
      }));

      // ─── PHASE 5: Save lean booking record ───────────────────────────────
      const primaryGuest = payload.roomTravellerInfo?.[0]?.travellerInfo?.[0];
      const saved = await hotelBookingRepository.createBooking({
        confirmationNumber: tjResponse.bookingId || bookingId,
        reservationId: tjResponse.bookingId || bookingId,
        propertyId: payload.propertyId || "TJ-PROP",
        provider: BookingProvider.TRIPJACK,
        status: isHoldIntent ? BookingStatus.HELD : BookingStatus.PENDING,
        checkIn: payload.checkIn ? new Date(payload.checkIn) : new Date(),
        checkOut: payload.checkOut
          ? new Date(payload.checkOut)
          : new Date(Date.now() + 86400000),
        totalAmount: round2(finalPrice),
        netAmount: round2(netPrice),
        markupAmount: round2(markup),
        totalAmount: round2(finalPrice),
        netAmount: round2(netPrice),
        markupAmount: round2(markup),
        guestName: primaryGuest
          ? `${primaryGuest.fN || ""} ${primaryGuest.lN || ""}`.trim()
          : "",
        guestEmail: payload.deliveryInfo?.emails?.[0] || "",
        guestMobile: payload.deliveryInfo?.contacts?.[0] || "",
        agentId: clientType === "B2B" ? (agentId || undefined) : undefined,
        userId: (clientType === "B2C" || clientType === "GUEST") ? (agentId || undefined) : undefined,
        agentName: clientType === "B2B" ? (agentName || undefined) : undefined,
        rooms,
        hotelName: payload.hotelName,
        hotelImage: extractHotelImage(payload.hotelImage),
        hotelAddress: payload.hotelAddress,
        city: payload.city,
        starRating: payload.starRating,
        propertyCode: payload.propertyId || "TJ-PROP",
        tripJackRequest: tjPayload, // Cache the compiled outbound request payload
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: payload.razorpayPaymentId,
        userInfo,
        clientType,
      });

      if (saved) {
        notificationService.sendBookingStatusEmail(saved, saved.status);
      }

      // Fire-and-forget: the response must not wait on TripJack's 180s async
      // window. An unattached rejection here would take the process down, and
      // the 2-minute status cron is the safety net if this poll dies.
      void pollTripJackBookingStatus(
      if (saved) {
        notificationService.sendBookingStatusEmail(saved, saved.status);
      }

      // Fire-and-forget: the response must not wait on TripJack's 180s async
      // window. An unattached rejection here would take the process down, and
      // the 2-minute status cron is the safety net if this poll dies.
      void pollTripJackBookingStatus(
        tjResponse.bookingId || bookingId,
        saved._id.toString(),
      ).catch((pollErr: any) =>
        console.error(
          `[TripJack] Background poll crashed for ${tjResponse.bookingId || bookingId}:`,
          pollErr?.message,
        ),
      ).catch((pollErr: any) =>
        console.error(
          `[TripJack] Background poll crashed for ${tjResponse.bookingId || bookingId}:`,
          pollErr?.message,
        ),
      );

      return {
        ...tjResponse,
        tripJackRequest: tjPayload,
        bookingRecord: saved,
      };
    } catch (bookingErr: any) {
      console.error(
        `❌ [TripJack] Critical Booking Error:`,
        bookingErr.message,
      );
      if (paymentProcessed && clientType === "B2B") {
        console.log(`[TripJack] Rolling back wallet due to commit failure...`);
        await WalletUtil.refundBalance(
          token!,
          finalPrice,
          demandBookingId,
          "Auto-refund: System error during booking",
        );
      }
      throw bookingErr;
    } finally {
      // Redis lock release is now handled cleanly by RedisLockUtil.executeWithLock
    }
  }

  async #commitRateGain(
    payload: any,
    agentId?: string | null,
    agentName?: string | null,
    token?: string,
    clientType: string = "B2C",
    requestId: string = "",
    userInfo?: IUserInfo,
  ) {
    if (clientType === "B2B" && !token)
      throw new Error("Authentication token is required for B2B booking.");

    console.log(
      `[RateGain] Starting Secure OTA Flow for Agent: ${agentId}, ClientType: ${clientType}, RequestId: ${requestId}`,
    );

    let netPrice = Number(payload.totalPrice || payload.amount || 0);
    if (isNaN(netPrice) || netPrice <= 0)
      throw new Error("Invalid price returned from RateGain.");
    console.log(`✅ [RateGain] Trusted Frontend Net Price: ₹${netPrice}`);

    let paymentProcessed = false;
    let finalPrice = netPrice;
    let markup = 0;
    const demandId = `RG-BOOK-${Date.now()}`;

    try {
      // PHASE 1: Revalidate with Supplier Adapter & Validation Engine
      const rgPrecheckPayload = payload.bookingPayload || payload;
      const freshPrecheck = await rateGainAdapter.precheck(rgPrecheckPayload);
      const expectedResult = {
        roomType: payload.roomName || payload.roomType,
        mealPlan: payload.boardType,
        price: netPrice,
      };

      const validationResult = ValidationEngine.validate(
        expectedResult,
        freshPrecheck,
        { fixed: 5, percent: 0.5 },
      );

      await BookingEventLogger.log(demandId, requestId, "PRECHECK_SUCCESS", {
        expectedResult,
        freshPrecheck,
      });

      if (validationResult.price < netPrice) {
        console.log(
          `📉 [RateGain] Price dropped from ₹${netPrice} to ₹${validationResult.price}. Passing savings to customer!`,
        );
        await BookingEventLogger.log(demandId, requestId, "PRICE_DROPPED", {
          oldPrice: netPrice,
          newPrice: validationResult.price,
        });
        netPrice = validationResult.price;
      }

      // PHASE 2: Markup & Total
      if (clientType === "B2B") {
        const markupRules = await WalletUtil.getMarkupRules(token!);
        let pricing = PricingUtil.calculatePriceWithMarkup(
          netPrice,
          markupRules,
          payload.additionalMarkup || payload.BookReservation?.additionalMarkup,
          payload.couponCode || payload.BookReservation?.couponCode,
        );
        finalPrice = pricing.total;
        finalPrice = pricing.total;
        markup = pricing.markup;
      } else {
        const requestedSellingRate = Number(
          payload.sellingRate ||
            payload.BookReservation?.sellingRate ||
            payload.BookReservation?.SellingRate ||
            netPrice,
        );
        finalPrice = round2(requestedSellingRate);
        // A selling rate below net is a loss, not a negative markup.
        markup = finalPrice > netPrice ? round2(finalPrice - netPrice) : 0;
        finalPrice = round2(requestedSellingRate);
        // A selling rate below net is a loss, not a negative markup.
        markup = finalPrice > netPrice ? round2(finalPrice - netPrice) : 0;
        console.log(
          `⏸️ [RateGain] B2C booking — Calculated SellingRate is ₹${finalPrice}`,
        );
      }

      // PHASE 3: Wallet Deduction (B2B ONLY)
      if (clientType === "B2B") {
        paymentProcessed = await WalletUtil.deductBalance(
          token!,
          finalPrice,
          demandId,
          `Hotel Booking at ${payload.BookReservation?.hotelName || payload.hotelName || "RateGain Hotel"}`,
        );
        if (!paymentProcessed)
          throw new StructuredError(
            "INSUFFICIENT_WALLET",
            "Wallet deduction failed.",
          );
        await BookingEventLogger.log(demandId, requestId, "WALLET_DEBITED", {
          amount: finalPrice,
        });
      } else {
        // B2C Flow - Payment is already processed by Payment Gateway
        paymentProcessed = true;
      }

      // PHASE 4: Provider Booking
      const rgPayload = { ...(payload.bookingPayload || payload) };

      // Override RoomTypeCode and allocationDetails with the validated values from freshPrecheck
      const validatedRooms = freshPrecheck.originalResponse?.body?.preCheckResponse?.rooms || [];
      if (validatedRooms.length > 0) {
        const selections = rgPayload.BookReservation?.RoomSelection || rgPayload.RoomSelection || [];
        selections.forEach((rs: any, idx: number) => {
          const validatedRoom = validatedRooms[idx] || validatedRooms[0];
          const validatedRate = validatedRoom?.rates?.[0];
          const validatedRoomCode = validatedRoom?.RoomCode;
          const validatedAllocation = validatedRate?.allocationDetails || validatedRoom?.allocationDetails;
          // Spec: Book must use the EXACT rate identifier confirmed in precheck.
          const validatedKey = validatedRate?.rateKey || validatedRate?.RoomSelectionKey;

          if (validatedRoomCode) {
            rs.RoomTypeCode = validatedRoomCode;
          }
          if (validatedAllocation) {
            rs.allocationDetails = validatedAllocation;
          }
          if (validatedKey) {
            rs.RoomSelectionKey = validatedKey;
          }
        });
      }

      const b2cSellingRate = Number(
        payload.sellingRate ||
          payload.BookReservation?.sellingRate ||
          payload.BookReservation?.SellingRate ||
          netPrice,
      );

      const roundedNetPrice = Number(netPrice.toFixed(2));
      // Pay the supplier the RAW net (EXCLUDES platform markup); fall back to netPrice if unavailable.
      const supplierBookingRate = Number(
        (freshPrecheck.supplierNet ?? netPrice).toFixed(2),
      );
      // Spec v1.5.3: B2C Net+Commission model requires SellingRate (the MSP from
      // precheck). Prefer the precheck MSP; fall back to the requested selling rate.
      const b2cMsp = (freshPrecheck as any).sellingRate;
      const rgSellingRate =
        clientType === "B2C"
          ? Number((b2cMsp ?? b2cSellingRate).toFixed(2))
          : undefined;

      if (rgPayload.BookReservation) {
        rgPayload.BookReservation.BookingRate = supplierBookingRate;
        if (rgSellingRate !== undefined)
          rgPayload.BookReservation.SellingRate = rgSellingRate;
      } else {
        rgPayload.BookingRate = supplierBookingRate;
        if (rgSellingRate !== undefined) rgPayload.SellingRate = rgSellingRate;
      }

      const rgResponse = await rateGainProvider.commit(rgPayload);

      // Per RateGain Smart Distribution spec, a CommitReservation is CONFIRMED only
      // when body.booking.status === "Confirmed". Any other value is NOT a
      // confirmation and must never be surfaced to the customer as one.
      const rgBooking = rgResponse.body?.booking;
      const rgStatus = (rgBooking?.status || "").toString();
      const hasConfirmation = !!(
        rgBooking?.confirmationNumber || rgBooking?.reservationId
      );
      const outerSuccess =
        rgResponse.status !== "false" &&
        rgResponse.status !== false &&
        (rgResponse.statusCode === 200 || rgResponse.statusCode === undefined);

      // Authoritative: only "Confirmed" (case-insensitive) counts as confirmed.
      const isConfirmed = /^confirmed$/i.test(rgStatus.trim());
      // Explicit terminal rejection from RateGain.
      const isHardFailure = /^(failed|cancelled|rejected)$/i.test(rgStatus.trim());
      // RateGain accepted the request (gave a ref or an OK envelope) and didn't hard-fail.
      // Confirmed → save CONFIRMED; accepted-but-not-confirmed (e.g. "ConfirmationFailed",
      // processing) → save MANUAL_REVIEW for reconciliation, WITHOUT faking a confirmation.
      const isAccepted = (outerSuccess || hasConfirmation) && !isHardFailure;

      await BookingEventLogger.log(demandId, requestId, "SUPPLIER_COMMIT", {
        success: isConfirmed,
        accepted: isAccepted,
        rgStatus,
      });

      // Genuine, unrecoverable rejection → refund (B2B) + throw, no record saved.
      if (!isAccepted) {
        if (clientType === "B2B") {
          await WalletUtil.refundBalance(
            token!,
            finalPrice,
            demandId,
            "Auto-refund: RateGain booking failed",
          );
        }
        const errorMessage =
          rgResponse.message ||
          (rgStatus ? `RateGain Booking Status: ${rgStatus}` : null) ||
          "RateGain rejected the booking.";
        throw new Error(errorMessage);
      }

      if (!isConfirmed) {
        console.warn(
          `⚠️ [RateGain] Booking accepted but NOT confirmed (status: "${rgStatus}"). Saving as MANUAL_REVIEW — no confirmation voucher will be sent.`,
        );
      }

      // Build lean rooms array
      const rgRooms = (
        payload.BookReservation?.RoomSelection ||
        payload.RoomSelection ||
        []
      ).map((room: any) => ({
        roomType: room.RoomTypeName || room.RoomTypeCode || "Standard Room",
        boardType: room.MealPlan || "",
        guests: (room.NumberOfAdults || 2) + (room.NumberOfChild || 0),
        price: Number(
          (
            finalPrice /
            Math.max(payload.BookReservation?.RoomSelection?.length || 1, 1)
          ).toFixed(2),
        ),
      }));

      const primaryGuest =
        payload.BookReservation?.RoomSelection?.[0]?.Guest?.[0];

      const saved = await hotelBookingRepository.createBooking({
        confirmationNumber:
          rgResponse.body?.booking?.confirmationNumber || "RG-PENDING",
        reservationId:
          rgResponse.body?.booking?.reservationId || "RG-PENDING",
        propertyId: payload.BookReservation?.propertyID || "RG-PROP",
        provider: BookingProvider.RATEGAIN,
        // CONFIRMED only when RateGain returns booking.status === "Confirmed";
        // otherwise MANUAL_REVIEW so ops/reconciliation can resolve it (never fake it).
        status: isConfirmed ? BookingStatus.CONFIRMED : BookingStatus.MANUAL_REVIEW,
        checkIn: new Date(payload.BookReservation?.checkin),
        checkOut: new Date(payload.BookReservation?.checkout),
        totalAmount: round2(finalPrice),
        netAmount: round2(netPrice),
        markupAmount: round2(markup),
        totalAmount: round2(finalPrice),
        netAmount: round2(netPrice),
        markupAmount: round2(markup),
        guestName: primaryGuest
          ? `${primaryGuest.FirstName || ""} ${primaryGuest.LastName || ""}`.trim()
          : "",
        guestEmail:
          primaryGuest?.Email ||
          payload.BookReservation?.emailAddress ||
          payload.deliveryInfo?.emails?.[0] ||
          "",
        guestMobile:
          primaryGuest?.ContactNumber ||
          payload.BookReservation?.phoneNumber ||
          payload.deliveryInfo?.contacts?.[0] ||
          "",
        agentId: clientType === "B2B" ? (agentId || undefined) : undefined,
        userId: (clientType === "B2C" || clientType === "GUEST") ? (agentId || undefined) : undefined,
        agentName: clientType === "B2B" ? (agentName || undefined) : undefined,
        rooms: rgRooms.length > 0 ? rgRooms : undefined,
        hotelName: payload.hotelName,
        hotelImage: extractHotelImage(payload.hotelImage),
        hotelAddress: payload.hotelAddress,
        city: payload.city,
        starRating: payload.starRating,
        hotelPhone:
          freshPrecheck.phone ||
          rgResponse?.body?.booking?.hotel?.phone ||
          rgResponse?.phone,
        rateComments:
          freshPrecheck.rateComments ||
          rgResponse?.body?.booking?.hotel?.rooms?.[0]?.rates?.[0]
            ?.rateComments,
        paymentType:
          freshPrecheck.paymentType ||
          rgResponse?.body?.booking?.hotel?.rooms?.[0]?.rates?.[0]?.paymentType,
        rateGainRequest: rgPayload,
        rateGainResponse: rgResponse,
        brandCode:
          rgPayload.BookReservation?.BrandCode ||
          rgPayload.BrandCode ||
          undefined,
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: payload.razorpayPaymentId,
        userInfo,
        clientType,
      });

      if (saved) {
        notificationService.sendBookingStatusEmail(saved, saved.status);
      if (saved) {
        notificationService.sendBookingStatusEmail(saved, saved.status);
      }

      return rgResponse;
    } catch (err: any) {
      if (paymentProcessed && clientType === "B2B") {
        console.log(`[RateGain] Rolling back wallet due to commit failure...`);
        await WalletUtil.refundBalance(
          token!,
          finalPrice,
          demandId,
          "Auto-refund: RateGain system error",
        );
      }
      throw err;
    } finally {
      // Redis lock release is now handled cleanly by RedisLockUtil.executeWithLock
    }
  }
}

export const commitService = new CommitService();
