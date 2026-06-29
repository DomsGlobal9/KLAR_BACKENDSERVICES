import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { tripJackAdapter } from "../adapters/tripjack.adapter";
import { rateGainAdapter } from "../adapters/rategain.adapter";
import { ValidationEngine, StructuredError } from "./ValidationEngine";
import { BookingStatus, BookingProvider } from "../models/Booking.model";
import { BookingEventLogger } from "../models/BookingEvent";
import { RedisLockUtil } from "./RedisLockUtil";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { notificationService } from "./notification.service";
import { WalletUtil, MarkupRule } from "../utils/wallet.util";
import { PricingUtil } from "../utils/pricing.util";

// ─── Async Polling Helpers ──────────────────────────────────────────────────

const POLL_TIMEOUT_MS = 60000; // Stop after 60 seconds (finite exponential)
const TJ_SUCCESS_STATUSES = new Set(["SUCCESS", "CONFIRMED", "ON_HOLD"]);
const TJ_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "CANCELLED"]);
const TJ_PENDING_STATUSES = new Set(["PAYMENT_SUCCESS", "PAYMENT_PENDING", "PENDING", "IN_PROGRESS", "CANCELLATION_PENDING"]);

async function pollTripJackBookingStatus(tjBookingId: string, dbBookingId: string, attempt: number = 1): Promise<void> {
    const maxAttempts = 5; // e.g. 5s, 10s, 20s, 30s -> Total ~65s

    if (attempt > maxAttempts) {
        console.log(`[TripJack] Polling timeout reached for ${tjBookingId}. Escalating to MANUAL_REVIEW.`);
        try {
            const details = await tripJackProvider.getBookingDetails(tjBookingId);
            await hotelBookingRepository.findByIdAndUpdate(dbBookingId, { status: BookingStatus.MANUAL_REVIEW, tripJackResponse: details });
            await BookingEventLogger.log(tjBookingId, dbBookingId, "POLLING_TIMEOUT", { status: "MANUAL_REVIEW" });
        } catch (e: any) {
            console.warn(`[TripJack] Failed to fetch final state on timeout for ${tjBookingId}:`, e.message);
        }
        return;
    }

    try {
        const details = await tripJackProvider.getBookingDetails(tjBookingId);
        const apiSuccess = details?.status?.success === true;
        const tjStatus: string = details?.order?.status || "";
        
        const isSystemPending = details?.isSystemPending === true;
        const isTerminal = TJ_SUCCESS_STATUSES.has(tjStatus) || TJ_FAILED_STATUSES.has(tjStatus);

        if (!isTerminal && (isSystemPending || TJ_PENDING_STATUSES.has(tjStatus) || !tjStatus)) {
            const backoffDelay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
            console.log(`[TripJack] Status ${tjStatus || 'UNKNOWN'}. Polling attempt ${attempt}/${maxAttempts}. Waiting ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return pollTripJackBookingStatus(tjBookingId, dbBookingId, attempt + 1);
        }

        if (apiSuccess && TJ_SUCCESS_STATUSES.has(tjStatus)) {
            const newStatus = tjStatus === "ON_HOLD" ? BookingStatus.HELD : BookingStatus.CONFIRMED;
            const updated = await hotelBookingRepository.findByIdAndUpdate(dbBookingId, { status: newStatus, tripJackResponse: details }, { new: true });
            if (updated) notificationService.sendBookingConfirmation(updated);
            return;
        }
        
        if (TJ_FAILED_STATUSES.has(tjStatus)) {
            await hotelBookingRepository.findByIdAndUpdate(dbBookingId, { status: BookingStatus.FAILED, tripJackResponse: details });
            // In Phase 3: the reconciliation worker will catch FAILED statuses and issue Wallet Refunds
            return;
        }

        // Unrecognized status, backoff and retry
        const backoffDelay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return pollTripJackBookingStatus(tjBookingId, dbBookingId, attempt + 1);
    } catch (err: any) {
        const backoffDelay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return pollTripJackBookingStatus(tjBookingId, dbBookingId, attempt + 1);
    }
}

// ─── Commit Service ─────────────────────────────────────────────────────────

class CommitService {
    async commit(payload: any, agentId?: string | null, agentName?: string | null, token?: string, clientType: string = "B2C", requestId: string = "") {
        const propertyId = (payload.propertyId || payload.PropertyId || payload.BookReservation?.propertyID || "").toString();
        const tjBookingId = (payload.bookingId || payload.ConfirmationNumber || "").toString();

        const isTripJack = propertyId.startsWith("TJ") || 
                           tjBookingId.startsWith("TJ") || 
                           tjBookingId.startsWith("TG") || 
                           payload.type === "HOTEL" || 
                           (!payload.BookReservation && payload.bookingId);

        // Lock key specific to this unique booking attempt (combining hotel + dates + user or optionId)
        // A generic key like "lock_booking_agent1" prevents concurrent duplicates
        const lockKey = `commit_lock_${agentId || "guest"}_${payload.optionId || payload.bookingId || tjBookingId}`;

        return RedisLockUtil.executeWithLock(lockKey, requestId, async () => {
            if (isTripJack) {
                return this.#commitTripJack(payload, agentId, agentName, token, clientType, requestId);
            }
            return this.#commitRateGain(payload, agentId, agentName, token, clientType, requestId);
        });
    }

    async #commitTripJack(payload: any, agentId?: string | null, agentName?: string | null, token?: string, clientType: string = "B2C", requestId: string = "") {
        if (!token) throw new Error("Authentication token is required for booking.");

        console.log(`[TripJack] Starting Secure OTA Flow for Agent: ${agentId}, ClientType: ${clientType}, RequestId: ${requestId}`);

        let bookingId = payload.bookingId;
        if (!bookingId) throw new Error("Booking ID is required from frontend.");

        let netPrice = payload.paymentInfos?.[0]?.amount || payload.totalPrice || payload.amount || 0;
        if (netPrice <= 0) throw new Error("Invalid price returned from provider or payload.");
        
        console.log(`✅ [TripJack] Trusted Frontend Net Price: ₹${netPrice}`);

        let paymentProcessed = false;
        const demandBookingId = `TJ-BOOK-${Date.now()}`;
        let finalPrice = payload.totalPrice || netPrice;
        let markup = 0;
        const isHoldIntent = payload.isHold === true || payload.holdBooking === true;

        try {
            // PHASE 1: Revalidate with Supplier Adapter & Validation Engine
            const tjPrecheckPayload = {
                correlationId: payload.correlationId,
                optionId: payload.optionId,
                reviewHash: payload.reviewHash,
                hid: payload.hid,
                propertyId: payload.propertyId
            };

            const freshPrecheck = await tripJackAdapter.precheck(tjPrecheckPayload);
            const expectedResult = {
                roomType: payload.roomName || payload.roomType,
                mealPlan: payload.boardType,
                price: netPrice
            };

            const validationResult = ValidationEngine.validate(expectedResult, freshPrecheck, { fixed: 10, percent: 0.5 });
            
            await BookingEventLogger.log(bookingId, requestId, "PRECHECK_SUCCESS", { expectedResult, freshPrecheck });
            
            if (validationResult.price < netPrice) {
                console.log(`📉 [TripJack] Price dropped from ₹${netPrice} to ₹${validationResult.price}. Passing savings to customer!`);
                await BookingEventLogger.log(bookingId, requestId, "PRICE_DROPPED", { oldPrice: netPrice, newPrice: validationResult.price });
                netPrice = validationResult.price;
            }

            // Update OptionId if changed
            if (freshPrecheck.optionId && freshPrecheck.optionId !== payload.optionId) {
                console.log(`🔄 [TripJack] OptionId remapped: ${payload.optionId} -> ${freshPrecheck.optionId}`);
                payload.optionId = freshPrecheck.optionId;
            }

            // PHASE 2: Calculate Final Price & Markup
            if (clientType === "B2B") {
                const markupRules = await WalletUtil.getMarkupRules(token);
                const pricing = PricingUtil.calculatePriceWithMarkup(netPrice, markupRules, payload.additionalMarkup, payload.couponCode);
                finalPrice = pricing.total;
                markup = pricing.markup;
                console.log(`✅ [Klar] Final Calculated B2B Price: ₹${finalPrice} (Admin + Additional Markup: ₹${markup})`);
            } else {
                console.log(`✅ [Klar] B2C Booking Price: ₹${finalPrice}`);
            }

            // PHASE 3: Wallet Deduction (Atomic)
            if (!isHoldIntent && clientType === "B2B") {
                paymentProcessed = await WalletUtil.deductBalance(token, finalPrice, demandBookingId, `Hotel Booking at ${payload.hotelName || 'TripJack Hotel'}`);
                if (!paymentProcessed) throw new StructuredError("INSUFFICIENT_WALLET", "Wallet deduction failed. Please check your balance.");
                await BookingEventLogger.log(bookingId, requestId, "WALLET_DEBITED", { amount: finalPrice });
            } else {
                console.log(`⏸️ [TripJack] B2C booking or Hold Booking Requested — Deferring immediate internal wallet deduction.`);
            }

        // PHASE 4: Provider Booking (Send ONLY Net Price)
            const tjPayload = {
                bookingId,
                type: "HOTEL",
                roomTravellerInfo: payload.roomTravellerInfo,
                deliveryInfo: payload.deliveryInfo,
                ...(payload.gstInfo && { gstInfo: payload.gstInfo }),
                // Guaranteed positive net amount injection for instant confirmations; strict omission for holds
                paymentInfos: !isHoldIntent ? [{ amount: netPrice }] : undefined
            };

            const tjResponse = await tripJackProvider.commit(tjPayload);

            await BookingEventLogger.log(bookingId, requestId, "SUPPLIER_COMMIT", { success: tjResponse.status });

            if (!tjResponse.status) {
                console.error(`❌ [TripJack] Booking failed: ${tjResponse.description}`);
                throw new Error(tjResponse.description || "Provider rejected the booking request.");
            }

            // Build lean rooms array — one entry per room, no raw blobs
            const numRooms = (payload.roomTravellerInfo || []).length || 1;
            const pricePerRoom = Number((netPrice / numRooms).toFixed(2));
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
                checkOut: payload.checkOut ? new Date(payload.checkOut) : new Date(Date.now() + 86400000),
                totalAmount: finalPrice,
                netAmount: netPrice,
                markupAmount: markup,
                guestName: primaryGuest ? `${primaryGuest.fN || ''} ${primaryGuest.lN || ''}`.trim() : "",
                guestEmail: payload.deliveryInfo?.emails?.[0] || "",
                guestMobile: payload.deliveryInfo?.contacts?.[0] || "",
                agentId: agentId || undefined,
                agentName: agentName || undefined,
                rooms,
                hotelName: payload.hotelName,
                hotelImage: payload.hotelImage,
                hotelAddress: payload.hotelAddress,
                city: payload.city,
                starRating: payload.starRating,
                propertyCode: payload.propertyId || "TJ-PROP",
                tripJackRequest: tjPayload, // Cache the compiled outbound request payload
            });

            pollTripJackBookingStatus(tjResponse.bookingId || bookingId, saved._id.toString());

            return {
                ...tjResponse,
                tripJackRequest: tjPayload,
                bookingRecord: saved
            };
        } catch (bookingErr: any) {
            console.error(`❌ [TripJack] Critical Booking Error:`, bookingErr.message);
            if (paymentProcessed) {
                console.log(`[TripJack] Rolling back wallet due to commit failure...`);
                await WalletUtil.refundBalance(token, finalPrice, demandBookingId, "Auto-refund: System error during booking");
            }
            throw bookingErr;
        } finally {
            // Redis lock release is now handled cleanly by RedisLockUtil.executeWithLock
        }
    }



    async #commitRateGain(payload: any, agentId?: string | null, agentName?: string | null, token?: string, clientType: string = "B2C", requestId: string = "") {
        if (!token) throw new Error("Authentication token is required for booking.");

        console.log(`[RateGain] Starting Secure OTA Flow for Agent: ${agentId}, ClientType: ${clientType}, RequestId: ${requestId}`);

        let netPrice = Number(payload.totalPrice || payload.amount || 0);
        if (isNaN(netPrice) || netPrice <= 0) throw new Error("Invalid price returned from RateGain.");
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
                price: netPrice
            };

            const validationResult = ValidationEngine.validate(expectedResult, freshPrecheck, { fixed: 5, percent: 0.5 });
            
            await BookingEventLogger.log(demandId, requestId, "PRECHECK_SUCCESS", { expectedResult, freshPrecheck });

            if (validationResult.price < netPrice) {
                console.log(`📉 [RateGain] Price dropped from ₹${netPrice} to ₹${validationResult.price}. Passing savings to customer!`);
                await BookingEventLogger.log(demandId, requestId, "PRICE_DROPPED", { oldPrice: netPrice, newPrice: validationResult.price });
                netPrice = validationResult.price;
            }

            // PHASE 2: Markup & Total
            if (clientType === "B2B") {
                const markupRules = await WalletUtil.getMarkupRules(token);
                let pricing = PricingUtil.calculatePriceWithMarkup(netPrice, markupRules, payload.additionalMarkup || payload.BookReservation?.additionalMarkup, payload.couponCode || payload.BookReservation?.couponCode);
                finalPrice = Math.round(pricing.total * 100) / 100;
                markup = pricing.markup;

                // PHASE 3: Wallet Deduction (B2B only)
                paymentProcessed = await WalletUtil.deductBalance(token, finalPrice, demandId, `Hotel Booking at ${payload.BookReservation?.hotelName || payload.hotelName || 'RateGain Hotel'}`);
                if (!paymentProcessed) throw new StructuredError("INSUFFICIENT_WALLET", "Wallet deduction failed.");
                await BookingEventLogger.log(demandId, requestId, "WALLET_DEBITED", { amount: finalPrice });
            } else {
                const requestedSellingRate = Number(payload.sellingRate || payload.BookReservation?.sellingRate || payload.BookReservation?.SellingRate || netPrice);
                finalPrice = requestedSellingRate;
                markup = finalPrice - netPrice;
                console.log(`⏸️ [RateGain] B2C booking — Skipping wallet operations. SellingRate is ₹${finalPrice}`);
            }

            // PHASE 4: Provider Booking
            const rgPayload = { ...(payload.bookingPayload || payload) };
            const b2cSellingRate = Number(payload.sellingRate || payload.BookReservation?.sellingRate || payload.BookReservation?.SellingRate || netPrice);

            if (rgPayload.BookReservation) {
                rgPayload.BookReservation.BookingRate = netPrice;
                rgPayload.BookReservation.sellingRate = clientType === "B2C" ? b2cSellingRate : netPrice;
                rgPayload.BookReservation.SellingRate = clientType === "B2C" ? b2cSellingRate : netPrice;
            } else {
                rgPayload.BookingRate = netPrice;
                rgPayload.sellingRate = clientType === "B2C" ? b2cSellingRate : netPrice;
                rgPayload.SellingRate = clientType === "B2C" ? b2cSellingRate : netPrice;
            }

            const rgResponse = await rateGainProvider.commit(rgPayload);

            const isRgSuccess = rgResponse.status !== "false" && 
                                rgResponse.status !== false &&
                                rgResponse.body?.booking?.status !== "ConfirmationFailed" &&
                                rgResponse.body?.booking?.status !== "Failed" &&
                                rgResponse.body?.booking?.status !== "Cancelled";

            await BookingEventLogger.log(demandId, requestId, "SUPPLIER_COMMIT", { success: isRgSuccess });

            if (!isRgSuccess) {
                if (clientType === "B2B") {
                    await WalletUtil.refundBalance(token, finalPrice, demandId, "Auto-refund: RateGain booking failed");
                }
                const errorMessage = rgResponse.message || (rgResponse.body?.booking?.status ? `RateGain Booking Status: ${rgResponse.body.booking.status}` : null) || "RateGain rejected the booking.";
                throw new Error(errorMessage);
            }

            // Build lean rooms array
            const rgRooms = (payload.BookReservation?.RoomSelection || payload.RoomSelection || []).map((room: any) => ({
                roomType: room.RoomTypeName || room.RoomTypeCode || "Standard Room",
                boardType: room.MealPlan || "",
                guests: (room.NumberOfAdults || 2) + (room.NumberOfChild || 0),
                price: Number((finalPrice / Math.max((payload.BookReservation?.RoomSelection?.length || 1), 1)).toFixed(2)),
            }));

            const primaryGuest = payload.BookReservation?.RoomSelection?.[0]?.Guest?.[0];

            const saved = await hotelBookingRepository.createBooking({
                confirmationNumber: rgResponse.body?.booking?.confirmationNumber || "RG-PENDING",
                reservationId: rgResponse.body?.booking?.reservationId || "RG-PENDING",
                propertyId: payload.BookReservation?.propertyID || "RG-PROP",
                provider: BookingProvider.RATEGAIN,
                status: BookingStatus.CONFIRMED,
                checkIn: new Date(payload.BookReservation?.checkin),
                checkOut: new Date(payload.BookReservation?.checkout),
                totalAmount: finalPrice,
                netAmount: netPrice,
                markupAmount: markup,
                guestName: primaryGuest ? `${primaryGuest.FirstName || ''} ${primaryGuest.LastName || ''}`.trim() : "",
                guestEmail: primaryGuest?.Email || payload.BookReservation?.emailAddress || payload.emailAddress || "",
                guestMobile: primaryGuest?.Phone || payload.BookReservation?.phoneNumber || "",
                agentId: agentId || undefined,
                agentName: agentName || undefined,
                rooms: rgRooms.length > 0 ? rgRooms : undefined,
                hotelName: payload.hotelName,
                hotelImage: payload.hotelImage,
                hotelAddress: payload.hotelAddress,
                city: payload.city,
                starRating: payload.starRating,
                hotelPhone: freshPrecheck.phone || rgResponse?.body?.booking?.hotel?.phone || rgResponse?.phone,
                rateComments: freshPrecheck.rateComments || rgResponse?.body?.booking?.hotel?.rooms?.[0]?.rates?.[0]?.rateComments,
                paymentType: freshPrecheck.paymentType || rgResponse?.body?.booking?.hotel?.rooms?.[0]?.rates?.[0]?.paymentType,
                rateGainRequest: rgPayload,
                rateGainResponse: rgResponse,
            });

            notificationService.sendBookingConfirmation(saved);

            return rgResponse;
        } catch (err: any) {
            if (paymentProcessed) {
                console.log(`[RateGain] Rolling back wallet due to commit failure...`);
                await WalletUtil.refundBalance(token, finalPrice, demandId, "Auto-refund: RateGain system error");
            }
            throw err;
        } finally {
            // Redis lock release is now handled cleanly by RedisLockUtil.executeWithLock
        }
    }
}

export const commitService = new CommitService();
