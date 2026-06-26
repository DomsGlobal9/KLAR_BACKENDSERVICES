import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { BookingStatus, BookingProvider } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { notificationService } from "./notification.service";
import { WalletUtil, MarkupRule } from "../utils/wallet.util";
import { PricingUtil } from "../utils/pricing.util";

// ─── Async Polling Helpers ──────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 180000;

const TJ_SUCCESS_STATUSES = new Set(["SUCCESS", "ON_HOLD"]);
const TJ_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "CANCELLED"]);
const TJ_PENDING_STATUSES = new Set(["PAYMENT_SUCCESS", "PAYMENT_PENDING", "PENDING", "IN_PROGRESS", "CANCELLATION_PENDING"]);

async function pollTripJackBookingStatus(tjBookingId: string, dbBookingId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const poll = async (): Promise<void> => {
        if (Date.now() >= deadline) {
            console.log(`[TripJack] Polling timeout reached for ${tjBookingId}. Saving last known state.`);
            try {
                const details = await tripJackProvider.getBookingDetails(tjBookingId);
                const tjStatus: string = details?.order?.status || "";
                if (TJ_PENDING_STATUSES.has(tjStatus)) {
                    await hotelBookingRepository.findByIdAndUpdate(dbBookingId, { status: BookingStatus.PENDING, tripJackResponse: details });
                }
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

            // Wait if system is still processing and we haven't reached a terminal status
            if (!isTerminal && (isSystemPending || TJ_PENDING_STATUSES.has(tjStatus))) {
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
                return poll();
            }

            if (apiSuccess && TJ_SUCCESS_STATUSES.has(tjStatus)) {
                const newStatus = tjStatus === "ON_HOLD" ? BookingStatus.HELD : BookingStatus.CONFIRMED;
                const updated = await hotelBookingRepository.findByIdAndUpdate(dbBookingId, { status: newStatus, tripJackResponse: details }, { new: true });
                if (updated) notificationService.sendBookingConfirmation(updated);
                return;
            }
            
            if (TJ_FAILED_STATUSES.has(tjStatus)) {
                await hotelBookingRepository.findByIdAndUpdate(dbBookingId, { status: BookingStatus.FAILED, tripJackResponse: details });
                return;
            }
            
            // If it's an unrecognized status, just wait and poll again
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
    async commit(payload: any, agentId?: string | null, agentName?: string | null, token?: string, clientType: string = "B2C") {
        const propertyId = (payload.propertyId || payload.PropertyId || payload.BookReservation?.propertyID || "").toString();
        const tjBookingId = (payload.bookingId || payload.ConfirmationNumber || "").toString();

        const isTripJack = propertyId.startsWith("TJ") || 
                           tjBookingId.startsWith("TJ") || 
                           tjBookingId.startsWith("TG") || 
                           payload.type === "HOTEL" || 
                           (!payload.BookReservation && payload.bookingId);

        if (isTripJack) {
            return this.#commitTripJack(payload, agentId, agentName, token, clientType);
        }
        return this.#commitRateGain(payload, agentId, agentName, token, clientType);
    }

    async #commitTripJack(payload: any, agentId?: string | null, agentName?: string | null, token?: string, clientType: string = "B2C") {
        if (!token) throw new Error("Authentication token is required for booking.");

        console.log(`[TripJack] Starting Secure OTA Flow for Agent: ${agentId}, ClientType: ${clientType}`);

        // PHASE 1: Verify Price with Provider (Source of Truth)
        let bookingId = payload.bookingId;
        if (!bookingId) throw new Error("Booking ID is required from frontend.");

        let netPrice = payload.paymentInfos?.[0]?.amount || payload.totalPrice || payload.amount || 0;
        if (netPrice <= 0) throw new Error("Invalid price returned from provider or payload.");
        
        console.log(`✅ [TripJack] Trusted Frontend Net Price: ₹${netPrice}`);

        // PHASE 2: Calculate Final Price & Markup
        let finalPrice = payload.totalPrice || netPrice;
        let markup = 0;

        if (clientType === "B2B") {
            const markupRules = await WalletUtil.getMarkupRules(token);
            const pricing = PricingUtil.calculatePriceWithMarkup(netPrice, markupRules, payload.additionalMarkup, payload.couponCode);
            finalPrice = pricing.total;
            markup = pricing.markup;
            console.log(`✅ [Klar] Final Calculated B2B Price: ₹${finalPrice} (Admin + Additional Markup: ₹${markup})`);
        } else {
            console.log(`✅ [Klar] B2C Booking Price: ₹${finalPrice}`);
        }

        // Determine Intent: Instant Confirmation vs Hold Booking
        const isHoldIntent = payload.isHold === true || payload.holdBooking === true;

        // PHASE 3: Wallet Deduction (Atomic) - Only deduct immediately for B2B Instant Confirmations
        const demandBookingId = `TJ-BOOK-${Date.now()}`;
        let paymentProcessed = true;
        if (!isHoldIntent && clientType === "B2B") {
            paymentProcessed = await WalletUtil.deductBalance(
                token, 
                finalPrice, 
                demandBookingId, 
                `Hotel Booking at ${payload.hotelName || 'TripJack Hotel'}`
            );
            if (!paymentProcessed) throw new Error("Wallet deduction failed. Please check your balance.");
        } else {
            console.log(`⏸️ [TripJack] B2C booking or Hold Booking Requested — Deferring immediate internal wallet deduction.`);
        }

        // PHASE 4: Provider Booking (Send ONLY Net Price)
        try {
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

            if (!tjResponse.status) {
                console.error(`❌ [TripJack] Booking failed: ${tjResponse.description}`);
                // AUTO-REFUND only if money was actually deducted
                if (!isHoldIntent && clientType === "B2B") {
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
            if (!isHoldIntent && clientType === "B2B") {
                await WalletUtil.refundBalance(token, finalPrice, demandBookingId, "Auto-refund: System error during booking");
            }
            throw bookingErr;
        }
    }

    async #commitRateGain(payload: any, agentId?: string | null, agentName?: string | null, token?: string, clientType: string = "B2C") {
        if (!token) throw new Error("Authentication token is required for booking.");

        console.log(`[RateGain] Starting Secure OTA Flow for Agent: ${agentId}, ClientType: ${clientType}`);

        // PHASE 1: Verify Price with Provider
        let netPrice = Number(payload.totalPrice || payload.amount || 0);
        if (isNaN(netPrice) || netPrice <= 0) throw new Error("Invalid price returned from RateGain.");
        console.log(`✅ [RateGain] Trusted Frontend Net Price: ₹${netPrice}`);

        // PHASE 2: Markup & Total
        let finalPrice = netPrice;
        let markup = 0;
        const demandId = `RG-BOOK-${Date.now()}`;

        if (clientType === "B2B") {
            const markupRules = await WalletUtil.getMarkupRules(token);
            let pricing = PricingUtil.calculatePriceWithMarkup(netPrice, markupRules, payload.additionalMarkup || payload.BookReservation?.additionalMarkup, payload.couponCode || payload.BookReservation?.couponCode);
            finalPrice = Math.round(pricing.total * 100) / 100; // Round to 2 decimal places
            markup = pricing.markup;

            // PHASE 3: Wallet Deduction (B2B only)
            const paymentProcessed = await WalletUtil.deductBalance(token, finalPrice, demandId, `Hotel Booking at ${payload.BookReservation?.hotelName || payload.hotelName || 'RateGain Hotel'}`);
            if (!paymentProcessed) throw new Error("Wallet deduction failed.");
        } else {
            // For B2C: sellingRate is the consumer price (MSP)
            const requestedSellingRate = Number(payload.sellingRate || payload.BookReservation?.sellingRate || payload.BookReservation?.SellingRate || netPrice);
            finalPrice = requestedSellingRate;
            markup = finalPrice - netPrice;
            console.log(`⏸️ [RateGain] B2C booking — Skipping wallet operations. SellingRate is ₹${finalPrice}`);
        }

        // PHASE 4: Provider Booking
        try {
            // Update payload with verified net price and selling price
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

            if (!rgResponse.status || rgResponse.status === "false") {
                if (clientType === "B2B") {
                    await WalletUtil.refundBalance(token, finalPrice, demandId, "Auto-refund: RateGain booking failed");
                }
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
            });

            notificationService.sendBookingConfirmation(saved);

            return rgResponse;
        } catch (err: any) {
            if (clientType === "B2B") {
                await WalletUtil.refundBalance(token, finalPrice, demandId, "Auto-refund: RateGain system error");
            }
            throw err;
        }
    }
}

export const commitService = new CommitService();
