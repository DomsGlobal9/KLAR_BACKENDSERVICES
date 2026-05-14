import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { BookingModel, BookingStatus, BookingProvider } from "../models/Booking.model";

class CancelService {
    async cancel(payload: any) {
        const confirmationNumber = payload.ConfirmationNumber || payload.bookingId;
        const reservationId = payload.ReservationId || payload.bookingId;
        const bookingId = payload.bookingId;

        console.log(`🚫 Cancel service called with:`, JSON.stringify(payload, null, 2));

        // ─── Step 0: Check if this is a TripJack booking ───
        try {
            const query: any = {};
            if (confirmationNumber) query.confirmationNumber = confirmationNumber;
            else if (reservationId) query.reservationId = reservationId;
            else if (bookingId) query.confirmationNumber = bookingId;

            const isTripJack = payload.type === "HOTEL" || 
                               confirmationNumber?.startsWith("TG") || 
                               confirmationNumber?.startsWith("TJ");

            let isDbTripJack = false;
            if (Object.keys(query).length > 0) {
                const booking = await BookingModel.findOne(query).lean();
                if (booking && booking.provider === BookingProvider.TRIPJACK) {
                    isDbTripJack = true;
                }
            }

            if (isTripJack || isDbTripJack) {
                const targetId = confirmationNumber || bookingId;
                console.log(`[TripJack] Cancelling TripJack booking: ${targetId}`);
                const tjResponse = await tripJackProvider.cancel(targetId);

                // Check actual status from TripJack side to confirm cancellation
                let finalStatus = "PENDING";
                let details = null;
                try {
                    details = await tripJackProvider.getBookingDetails(targetId);
                    finalStatus = details?.order?.status || "PENDING";
                    console.log(`[TripJack] Live status post-cancel check: ${finalStatus}`);
                } catch (statusErr: any) {
                    console.warn("[TripJack] Could not immediately verify cancelled status:", statusErr.message);
                }

                // If cancel API returns success true, TripJack acknowledges the cancellation immediately
                const isSuccessAck = tjResponse?.body?.status?.success === true || tjResponse?.status?.success === true || tjResponse?.status === true;
                const isFullyCancelled = isSuccessAck || finalStatus.toUpperCase() === "CANCELLED";
                const dbStatusToSet = isFullyCancelled ? BookingStatus.CANCELLED : BookingStatus.PENDING;

                if (Object.keys(query).length > 0) {
                    await BookingModel.findOneAndUpdate(query, { 
                        status: dbStatusToSet,
                        tripJackResponse: details || tjResponse?.body
                    });
                    console.log(`✅ [TripJack] Booking status updated in DB to ${dbStatusToSet}: ${targetId}`);
                }

                return {
                    status: true,
                    statusCode: 200,
                    description: isFullyCancelled ? "TripJack Cancel Success" : "Cancellation initiated. Pending confirmation from TripJack supplier.",
                    isFullyCancelled,
                    tjStatus: finalStatus,
                    body: tjResponse?.body || tjResponse
                };
            }
        } catch (tjCancelErr: any) {
            console.error("[TripJack] Cancel routing error:", tjCancelErr.message);
            throw tjCancelErr;
        }

        // ─── Step 1: Look up booking from DB to get the full original request data ───
        let enrichedPayload = { ...payload };
        let dbLookupSucceeded = false;

        try {
            const query: any = {};
            if (confirmationNumber) query.confirmationNumber = confirmationNumber;
            else if (reservationId) query.reservationId = reservationId;

            if (Object.keys(query).length > 0) {
                console.log(`🔍 Looking up booking in DB with query:`, JSON.stringify(query));
                const booking = await BookingModel.findOne(query).lean();

                if (booking) {
                    console.log(`📦 Found booking in DB: ${booking.confirmationNumber}`);
                    console.log(`📦 rateGainRequest exists: ${!!booking.rateGainRequest}`);
                    console.log(`📦 rateGainRequest.BookReservation exists: ${!!booking.rateGainRequest?.BookReservation}`);

                    // Extract the original BookReservation from the stored rateGainRequest
                    const originalRequest = booking.rateGainRequest?.BookReservation || {};
                    const rateGainResp = booking.rateGainResponse || {};

                    const brandCode = originalRequest.BrandCode
                        || rateGainResp.body?.brandCode
                        || rateGainResp.body?.BrandCode
                        || payload.BrandCode
                        || booking.propertyCode
                        || originalRequest.PropertyCode
                        || payload.PropertyCode
                        || "N/A";

                    console.log(`📦 Extracted BrandCode: "${brandCode}"`);

                    // Build a complete cancellation payload using stored data
                    enrichedPayload = {
                        ConfirmationNumber: booking.confirmationNumber,
                        ReservationId: booking.reservationId,
                        PropertyId: booking.propertyId,
                        PropertyCode: booking.propertyCode || originalRequest.PropertyCode || payload.PropertyCode,
                        BrandCode: brandCode,
                        CurrencyCode: originalRequest.CurrencyCode || booking.currencyCode || "USD",
                        CountryCode: originalRequest.CountryCode || "IN",
                        Session: originalRequest.Session || `klar-session-${Date.now()}`,
                        EchoToken: payload.EchoToken || originalRequest.EchoToken || `echo-${Date.now()}`,
                        TimeStamp: payload.TimeStamp || new Date().toISOString(),
                        DemandCancelId: payload.DemandCancelId || `demand-cancel-${Date.now()}`,
                    };

                    dbLookupSucceeded = true;
                    console.log(`✅ Enriched cancel payload:`, JSON.stringify(enrichedPayload, null, 2));
                } else {
                    console.warn(`⚠️ Booking NOT found in DB (conf: ${confirmationNumber}, resId: ${reservationId}). Using raw payload.`);
                }
            } else {
                console.warn(`⚠️ No ConfirmationNumber or ReservationId in payload. Cannot look up booking.`);
            }
        } catch (dbError: any) {
            console.error('❌ DB lookup failed, falling back to raw payload:', dbError.message);
        }

        if (!dbLookupSucceeded) {
            console.warn(`⚠️ Using raw/fallback payload for cancel:`, JSON.stringify(enrichedPayload, null, 2));
            if (!enrichedPayload.BrandCode) {
                enrichedPayload.BrandCode = enrichedPayload.PropertyCode || "N/A";
            }
        }

        // ─── Step 2: Call RateGain CancelReservation ───
        let rateGainResponse;
        try {
            rateGainResponse = await rateGainProvider.cancel(enrichedPayload);
        } catch (error: any) {
            const errorDataStr = JSON.stringify(error.response?.data || {});
            const errorDesc = error.response?.data?.description || error.response?.data?.Description || error.message || "";

            // If RateGain throws "ConfirmationNumber(...) Number Invalid", it means the booking is already cancelled on their side.
            if ((error.response?.status === 400 || error.response?.status === 500) && (errorDesc.includes("Number Invalid") || errorDataStr.includes("Number Invalid"))) {
                console.log(`⚠️ RateGain says Number Invalid. Assuming booking is already cancelled on their end. Gracefully syncing local DB.`);
                rateGainResponse = {
                    status: true,
                    statusCode: 200,
                    body: {
                        cancellationNumber: "PREV-CANCELLED",
                        confirmationNumber: confirmationNumber || enrichedPayload.ConfirmationNumber,
                        status: "CANCELLED"
                    }
                };
            } else {
                throw error; // Rethrow actual failures
            }
        }

        // ─── Step 3: Update local DB status if cancellation succeeded ───
        try {
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === 'success')) {
                if (confirmationNumber || reservationId) {
                    const query: any = {};
                    if (confirmationNumber) query.confirmationNumber = confirmationNumber;
                    if (reservationId) query.reservationId = reservationId;

                    const updated = await BookingModel.findOneAndUpdate(
                        query,
                        { status: BookingStatus.CANCELLED },
                        { new: true }
                    );

                    if (updated) {
                        console.log(`✅ Updated local DB booking to CANCELLED: ${updated.confirmationNumber}`);
                    }
                }
            }
        } catch (dbError: any) {
            console.error('⚠️ local DB update failed (RateGain cancel was successful):', dbError.message);
        }

        return rateGainResponse;
    }
}

export const cancelService = new CancelService();
