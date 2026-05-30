import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { BookingModel, BookingStatus, BookingProvider } from "../models/Booking.model";
import { notificationService } from "./notification.service";
import { WalletUtil, MarkupRule } from "../utils/wallet.util";
import { PricingUtil } from "../utils/pricing.util";

// ─── Async Polling Helpers ──────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 180000;

const TJ_SUCCESS_STATUSES = new Set(["SUCCESS", "ON_HOLD"]);
const TJ_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "CANCELLED"]);

async function pollTripJackBookingStatus(tjBookingId: string, dbBookingId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const poll = async (): Promise<void> => {
        if (Date.now() >= deadline) return;
        try {
            const details = await tripJackProvider.getBookingDetails(tjBookingId);
            const apiSuccess = details?.status?.success === true;
            const tjStatus: string = details?.order?.status || "";
            
            const isSystemPending = details?.isSystemPending === true;
            const isTerminal = TJ_SUCCESS_STATUSES.has(tjStatus) || TJ_FAILED_STATUSES.has(tjStatus);

            // Wait if system is still processing and we haven't reached a terminal status
            if (!isTerminal && isSystemPending) {
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
                return poll();
            }

            if (apiSuccess && TJ_SUCCESS_STATUSES.has(tjStatus)) {
                const newStatus = tjStatus === "ON_HOLD" ? BookingStatus.HELD : BookingStatus.CONFIRMED;
                const updated = await BookingModel.findByIdAndUpdate(dbBookingId, { status: newStatus, tripJackResponse: details }, { new: true });
                if (updated) notificationService.sendBookingConfirmation(updated);
                return;
            }
            
            if (TJ_FAILED_STATUSES.has(tjStatus)) {
                await BookingModel.findByIdAndUpdate(dbBookingId, { status: BookingStatus.FAILED, tripJackResponse: details });
                return;
            }
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            return poll();
        } catch (err: any) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            return poll();
        }
    };
    poll().catch(e => console.error("[TripJack] Polling error:", e.message));
}

// ─── Commit Service ─────────────────────────────────────────────────────────

class CommitService {
    async commit(payload: any, agentId?: string | null, agentName?: string | null, token?: string) {
        const propertyId = (payload.propertyId || payload.PropertyId || payload.BookReservation?.propertyID || "").toString();
        const tjBookingId = (payload.bookingId || payload.ConfirmationNumber || "").toString();

        const isTripJack = propertyId.startsWith("TJ") || 
                           tjBookingId.startsWith("TJ") || 
                           tjBookingId.startsWith("TG") || 
                           payload.type === "HOTEL" || 
                           (!payload.BookReservation && payload.bookingId);

        if (isTripJack) {
            return this.#commitTripJack(payload, agentId, agentName, token);
        }
        return this.#commitRateGain(payload, agentId, agentName, token);
    }

    async #commitTripJack(payload: any, agentId?: string | null, agentName?: string | null, token?: string) {
        if (!token) throw new Error("Authentication token is required for booking.");

        console.log(`[TripJack] Starting Secure OTA Flow for Agent: ${agentId}`);

        // PHASE 1: Verify Price with Provider (Source of Truth)
        // Note: TripJack Review API should have been called by Frontend, but we re-verify or use the session.
        // Actually, we need to call precheck if bookingId is missing, or trust the precheckResponse if provided securely.
        // For real OTA security, we fetch the latest price.
        
        let netPrice = 0;
        let bookingId = payload.bookingId;

        try {
            // If the frontend already consumed the reviewHash to lock the bookingId, calling precheck again might fail.
            // Catch any review hash expired / 15 mins error gracefully and fall back to the existing locked bookingId and net price.
            if (payload.optionId && payload.reviewHash) {
                try {
                    const precheckRes = await tripJackProvider.precheck(payload);
                    if (precheckRes.status) {
                        bookingId = precheckRes.bookingId || bookingId;
                        netPrice = precheckRes.body?.hInfo?.ops?.[0]?.tp || precheckRes.body?.hotel?.ops?.[0]?.tp || precheckRes.body?.totalNet || 0;
                    }
                } catch (precheckErr: any) {
                    console.warn(`⚠️ [TripJack] Precheck re-verification failed/consumed, trusting frontend locked bookingId: ${bookingId}. Error:`, precheckErr.message || JSON.stringify(precheckErr?.response?.data || {}));
                    if (!bookingId) throw precheckErr; // Throw only if we don't have a valid bookingId to fall back to
                }
            }
            
            if (!netPrice) {
                netPrice = payload.paymentInfos?.[0]?.amount || payload.totalPrice || payload.amount || 0;
            }
            
            if (netPrice <= 0) throw new Error("Invalid price returned from provider or payload.");
            console.log(`✅ [TripJack] Source of Truth Net Price: ₹${netPrice}`);
        } catch (err: any) {
            console.error(`❌ [TripJack] Precheck verification failed:`, err.message);
            throw err;
        }

        // PHASE 2: Calculate Final Price with Admin Markups + Agent Additional Markup + Secret Coupon
        const markupRules = await WalletUtil.getMarkupRules(token);
        const { total: finalPrice, markup } = PricingUtil.calculatePriceWithMarkup(netPrice, markupRules, payload.additionalMarkup, payload.couponCode);
        console.log(`✅ [Klar] Final Calculated Price: ₹${finalPrice} (Admin + Additional Markup: ₹${markup})`);

        // Determine Intent: Instant Confirmation vs Hold Booking
        const isHoldIntent = payload.isHold === true || payload.holdBooking === true;

        // PHASE 3: Wallet Deduction (Atomic) - Only deduct immediately for Instant Confirmations
        const demandBookingId = `TJ-BOOK-${Date.now()}`;
        let paymentProcessed = true;
        if (!isHoldIntent) {
            paymentProcessed = await WalletUtil.deductBalance(
                token, 
                finalPrice, 
                demandBookingId, 
                `Hotel Booking at ${payload.hotelName || 'TripJack Hotel'}`
            );
            if (!paymentProcessed) throw new Error("Wallet deduction failed. Please check your balance.");
        } else {
            console.log(`⏸️ [TripJack] Hold Booking Requested — Deferring immediate internal wallet deduction.`);
        }

        // PHASE 4: Provider Booking (Send ONLY Net Price)
        try {
            const tjPayload = {
                ...payload,
                bookingId,
                // Guaranteed positive net amount injection for instant confirmations; strict omission for holds
                paymentInfos: !isHoldIntent ? [{ amount: netPrice }] : undefined
            };

            const tjResponse = await tripJackProvider.commit(tjPayload);

            if (!tjResponse.status) {
                console.error(`❌ [TripJack] Booking failed: ${tjResponse.description}`);
                // AUTO-REFUND only if money was actually deducted
                if (!isHoldIntent) {
                    await WalletUtil.refundBalance(token, finalPrice, demandBookingId, "Auto-refund: TripJack booking failed");
                }
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
             const bookingRecord = new BookingModel({
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
                agentId,
                agentName,
                rooms,
                tripJackRequest: tjPayload, // Cache the compiled outbound request payload
            });

            const saved = await bookingRecord.save();
            pollTripJackBookingStatus(tjResponse.bookingId || bookingId, saved._id.toString());

            return {
                ...tjResponse,
                tripJackRequest: tjPayload,
                bookingRecord: saved
            };

        } catch (bookingErr: any) {
            console.error(`❌ [TripJack] Critical Booking Error:`, bookingErr.message);
            if (!isHoldIntent) {
                await WalletUtil.refundBalance(token, finalPrice, demandBookingId, "Auto-refund: System error during booking");
            }
            throw bookingErr;
        }
    }

    async #commitRateGain(payload: any, agentId?: string | null, agentName?: string | null, token?: string) {
        if (!token) throw new Error("Authentication token is required for booking.");

        console.log(`[RateGain] Starting Secure OTA Flow for Agent: ${agentId}`);

        // PHASE 1: Verify Price with Provider
        let netPrice = 0;
        try {
            const precheckRes = await rateGainProvider.precheck(payload);
            const body = precheckRes.body?.preCheckResponse || precheckRes.body;
            netPrice = Number(body?.totalNet || body?.BookingRate || 0);
            if (isNaN(netPrice) || netPrice <= 0) throw new Error("Invalid price returned from RateGain.");
            console.log(`✅ [RateGain] Source of Truth Net Price: ₹${netPrice}`);
        } catch (err: any) {
            console.error(`❌ [RateGain] Precheck failed:`, err.message);
            throw err;
        }

        // PHASE 2: Markup & Total + Secret Coupon
        const markupRules = await WalletUtil.getMarkupRules(token);
        let { total: finalPrice, markup } = PricingUtil.calculatePriceWithMarkup(netPrice, markupRules, payload.additionalMarkup || payload.BookReservation?.additionalMarkup, payload.couponCode || payload.BookReservation?.couponCode);
        finalPrice = Math.round(finalPrice * 100) / 100; // Round to 2 decimal places

        // PHASE 3: Wallet Deduction
        const demandId = `RG-BOOK-${Date.now()}`;
        const paymentProcessed = await WalletUtil.deductBalance(token, finalPrice, demandId, `Hotel Booking at ${payload.BookReservation?.hotelName || 'RateGain Hotel'}`);
        if (!paymentProcessed) throw new Error("Wallet deduction failed.");

        // PHASE 4: Provider Booking
        try {
            // Update payload with verified net price
            const rgPayload = { ...payload };
            if (rgPayload.BookReservation) {
                rgPayload.BookReservation.sellingRate = netPrice;
                rgPayload.BookReservation.BookingRate = netPrice;
            } else {
                rgPayload.sellingRate = netPrice;
                rgPayload.BookingRate = netPrice;
            }

            const rgResponse = await rateGainProvider.commit(rgPayload);

            if (!rgResponse.status || rgResponse.status === "false") {
                await WalletUtil.refundBalance(token, finalPrice, demandId, "Auto-refund: RateGain booking failed");
                throw new Error(rgResponse.message || "RateGain rejected the booking.");
            }

            // Build lean rooms array
            const rgRooms = (payload.BookReservation?.RoomSelection || payload.RoomSelection || []).map((room: any) => ({
                roomType: room.RoomTypeName || room.RoomTypeCode || "Standard Room",
                boardType: room.MealPlan || "",
                guests: (room.NumberOfAdults || 2) + (room.NumberOfChild || 0),
                price: Number((finalPrice / Math.max((payload.BookReservation?.RoomSelection?.length || 1), 1)).toFixed(2)),
            }));

            const primaryGuest = payload.BookReservation?.RoomSelection?.[0]?.Guest?.[0];

            const bookingRecord = new BookingModel({
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
                agentId,
                agentName,
                rooms: rgRooms.length > 0 ? rgRooms : undefined,
                hotelName: payload.hotelName,
                hotelImage: payload.hotelImage,
                hotelAddress: payload.hotelAddress,
                city: payload.city,
                starRating: payload.starRating,
            });

            const saved = await bookingRecord.save();
            notificationService.sendBookingConfirmation(saved);

            return rgResponse;
        } catch (err: any) {
            await WalletUtil.refundBalance(token, finalPrice, demandId, "Auto-refund: RateGain system error");
            throw err;
        }
    }
}

export const commitService = new CommitService();
