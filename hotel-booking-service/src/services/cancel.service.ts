import { rateGainProvider } from "../providers/rategain.provider";
import { BookingModel, BookingStatus } from "../models/Booking.model";

class CancelService {
    async cancel(payload: any) {
        const confirmationNumber = payload.ConfirmationNumber;
        const reservationId = payload.ReservationId;

        console.log(`🚫 Cancel service called with:`, JSON.stringify(payload, null, 2));

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
        const rateGainResponse = await rateGainProvider.cancel(enrichedPayload);

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
