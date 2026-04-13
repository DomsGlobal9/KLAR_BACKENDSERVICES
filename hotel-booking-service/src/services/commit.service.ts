import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { BookingModel, BookingStatus, BookingProvider } from "../models/Booking.model";
import { notificationService } from "./notification.service";

// ─── Async Polling Helpers ──────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;   // 5 seconds
const POLL_TIMEOUT_MS = 180000; // 3 minutes (as per TripJack docs)

/**
 * TripJack terminal statuses from booking-details.
 * Poll until one of these is returned, or 180s elapses.
 */
const TJ_SUCCESS_STATUSES = new Set(["SUCCESS", "ON_HOLD"]);
const TJ_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "CANCELLED"]);

/**
 * Poll /oms/v3/hotel/booking-details every 5s.
 * FIX #7: status is at details.order.status (not details.bookingStatus)
 */
async function pollTripJackBookingStatus(
    tjBookingId: string,
    dbBookingId: string
): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const poll = async (): Promise<void> => {
        if (Date.now() >= deadline) {
            console.warn(`[TripJack] Polling timeout for booking ${tjBookingId}. Leaving as PENDING.`);
            return;
        }

        try {
            const details = await tripJackProvider.getBookingDetails(tjBookingId);

            // FIX #7: correct path is details.order.status
            const tjStatus: string = details?.order?.status || "";
            console.log(`[TripJack] Polling ${tjBookingId}: order.status=${tjStatus}`);

            if (TJ_SUCCESS_STATUSES.has(tjStatus)) {
                const newStatus = tjStatus === "ON_HOLD"
                    ? BookingStatus.HELD
                    : BookingStatus.CONFIRMED;

                const updated = await BookingModel.findByIdAndUpdate(dbBookingId, {
                    status: newStatus,
                    tripJackResponse: details,
                }, { new: true });
                console.log(`✅ [TripJack] Booking ${tjStatus} in DB: ${tjBookingId}`);

                // Trigger automated confirmation email
                if (updated) {
                    notificationService.sendBookingConfirmation(updated);
                }
                return;
            }

            if (TJ_FAILED_STATUSES.has(tjStatus)) {
                await BookingModel.findByIdAndUpdate(dbBookingId, {
                    status: BookingStatus.FAILED,
                    tripJackResponse: details,
                });
                console.warn(`❌ [TripJack] Booking ${tjStatus} in DB: ${tjBookingId}`);
                return;
            }

            // Still in-progress (IN_PROGRESS, PAYMENT_SUCCESS, PAYMENT_PENDING, PENDING)
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            return poll();
        } catch (err: any) {
            console.error("[TripJack] Polling error:", err.message);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            return poll();
        }
    };

    // Fire-and-forget: does NOT block the HTTP response to the client
    poll().catch(e => console.error("[TripJack] Polling uncaught:", e.message));
}

// ─── Commit Service ─────────────────────────────────────────────────────────

class CommitService {
    async commit(payload: any, agentId?: string | null, agentName?: string | null) {
        const propertyId = (payload.propertyId || payload.PropertyId || payload.BookReservation?.propertyID || "").toString();
        const tjBookingId = (payload.bookingId || payload.ConfirmationNumber || "").toString();

        if (propertyId.startsWith("TJ:") || tjBookingId.startsWith("TJ")) {
            return this.#commitTripJack(payload, agentId, agentName);
        }

        return this.#commitRateGain(payload, agentId, agentName);
    }

    // ── TripJack Booking ──────────────────────────────────────────────────

    async #commitTripJack(payload: any, agentId?: string | null, agentName?: string | null) {
        // Calls POST /oms/v3/hotel/book with corrected schema
        const tjResponse = await tripJackProvider.commit(payload);

        try {
            const body = tjResponse.body || {};

            // TripJack Book API returns bookingId at body.bookingId (e.g. "TJ202487947162")
            const tjBookingId: string = tjResponse.bookingId || body.bookingId || `TJ-${Date.now()}`;

            // Guest name from roomTravellerInfo[0].travellerInfo[0]
            const firstTraveller = payload.roomTravellerInfo?.[0]?.travellerInfo?.[0] || {};
            const guestName = `${firstTraveller.fN || ""} ${firstTraveller.lN || ""}`.trim() || "Unknown";

            const amenities: string[] = payload.amenities || [];
            const images: string[] = payload.images || [];
            const totalAmount: number = payload.totalPrice || 0;

            const bookingRecord = new BookingModel({
                confirmationNumber: tjBookingId,
                reservationId: tjBookingId,
                propertyId: payload.propertyId || "TJ-PROP",
                propertyCode: (payload.propertyId || "").replace("TJ:", "") || "TJ",
                provider: BookingProvider.TRIPJACK,
                status: BookingStatus.PENDING, // will be updated by poller
                checkIn: payload.checkIn ? new Date(payload.checkIn) : new Date(),
                checkOut: payload.checkOut ? new Date(payload.checkOut) : new Date(Date.now() + 86400000),
                totalAmount,
                currencyCode: payload.currency || "INR",
                guestName,
                agentId,
                agentName,

                // Hotel display fields
                hotelName: payload.hotelName || undefined,
                hotelImage: payload.hotelImage || (images[0] || undefined),
                roomType: payload.roomName || payload.roomType || undefined,
                amenities,
                images,

                // Rooms — one entry per roomTravellerInfo element
                rooms: (payload.roomTravellerInfo || []).map((room: any) => ({
                    roomType: payload.roomName || "Room",
                    guests: (room.travellerInfo || []).length,
                    price: totalAmount,
                })),

                tripJackRequest: payload,
                tripJackResponse: tjResponse,
            });

            const saved = await bookingRecord.save();
            console.log(`[FORENSIC] TripJack Saved Object: ID=${saved._id}, agentId=${saved.agentId}, conf=${saved.confirmationNumber}`);
            console.log(`✅ [TripJack] Saved PENDING booking: ${tjBookingId} for Agent: ${agentId}`);

            // Start async polling (non-blocking)
            pollTripJackBookingStatus(tjBookingId, (saved._id as any).toString());

        } catch (dbError: any) {
            console.error("⚠️  [TripJack] DB insert failed (TripJack API was successful):", dbError.message);
        }

        return tjResponse;
    }

    // ── RateGain Booking ──────────────────────────────────────────────────

    async #commitRateGain(payload: any, agentId?: string | null, agentName?: string | null) {
        const rateGainResponse = await rateGainProvider.commit(payload);

        try {
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === "success")) {
                const bookReservation = payload?.BookReservation || {};
                const rategainBooking = rateGainResponse.body?.booking || {};

                const firstRoom = Array.isArray(bookReservation.RoomSelection) ? bookReservation.RoomSelection[0] : null;
                const firstGuest = firstRoom && Array.isArray(firstRoom.Guest) ? firstRoom.Guest[0] : null;
                const guestName = firstGuest
                    ? `${firstGuest.FirstName || ""} ${firstGuest.LastName || ""}`.trim()
                    : "Unknown";

                const confirmationNumber =
                    rategainBooking.confirmationNumber ||
                    rategainBooking.ConfirmationNumber ||
                    rateGainResponse.ConfirmationNumber ||
                    bookReservation.EchoToken ||
                    "CONF-UNKNOWN";

                const reservationId =
                    rategainBooking.ReservationId ||
                    rategainBooking.reservationId ||
                    confirmationNumber;

                if (!rateGainResponse.body) rateGainResponse.body = {};
                if (bookReservation.hotelName) rateGainResponse.body.hotelName = bookReservation.hotelName;
                if (bookReservation.hotelImage) rateGainResponse.body.hotelImage = bookReservation.hotelImage;
                if (bookReservation.roomType) rateGainResponse.body.roomType = bookReservation.roomType;

                const finalAmount = bookReservation.sellingRate || bookReservation.BookingRate || 0;
                const finalCurrency = bookReservation.sellingRate ? "INR" : (bookReservation.CurrencyCode || "USD");

                const amenities: string[] = bookReservation.amenities || [];
                const images: string[] = bookReservation.images || [];

                const bookingRecord = new BookingModel({
                    confirmationNumber,
                    reservationId,
                    propertyId: bookReservation.propertyID || bookReservation.PropertyId || bookReservation.PropertyCode,
                    propertyCode: bookReservation.PropertyCode || "RG",
                    provider: BookingProvider.RATEGAIN,
                    status: BookingStatus.CONFIRMED,
                    checkIn: bookReservation.checkin ? new Date(bookReservation.checkin) : new Date(),
                    checkOut: bookReservation.checkout ? new Date(bookReservation.checkout) : new Date(Date.now() + 86400000),
                    totalAmount: finalAmount,
                    currencyCode: finalCurrency,
                    guestName,
                    agentId,
                    agentName,

                    hotelName: bookReservation.hotelName || undefined,
                    hotelImage: bookReservation.hotelImage || (images[0] || undefined),
                    roomType: bookReservation.roomName || undefined,
                    amenities,
                    images,

                    rooms: Array.isArray(bookReservation.RoomSelection)
                        ? bookReservation.RoomSelection
                        : (Array.isArray(payload.RoomSelection) ? payload.RoomSelection : []),

                    rateGainRequest: payload,
                    rateGainResponse: rateGainResponse,
                });

                const saved = await bookingRecord.save();
                console.log(`[FORENSIC] RateGain Saved Object: ID=${saved._id}, agentId=${saved.agentId}, conf=${saved.confirmationNumber}`);
                console.log(`✅ [RateGain] Saved booking to DB: ${confirmationNumber} for Agent: ${agentId}`);

                // Trigger automated confirmation email
                notificationService.sendBookingConfirmation(saved);
            }
        } catch (dbError: any) {
            console.error("⚠️  [RateGain] DB insert failed (RateGain was successful):", dbError.message);
        }

        return rateGainResponse;
    }
}

export const commitService = new CommitService();
