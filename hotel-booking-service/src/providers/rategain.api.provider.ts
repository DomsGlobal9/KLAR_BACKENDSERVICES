import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {

    /**
     * POST /api/SmartDistribution/PreCheckReservation
     * Validate rate and availability before committing a booking.
     */
    async precheck(payload: any) {
        const booking = payload.BookReservation || {};
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                ReservationDate: booking.ReservationDate || new Date().toISOString().split("T")[0],
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
            },
        };

        try {
            const response = await rateGainClient.post("/api/SmartDistribution/PreCheckReservation", consolidatedPayload);
            return response.data;
        } catch (error: any) {
            console.error("[RateGain] PreCheck Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }

    /**
     * POST /api/SmartDistribution/CommitReservation
     * Finalize and commit a hotel reservation.
     */
    async commit(payload: any) {
        const booking = payload.BookReservation || {};
        const now = new Date().toISOString();

        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
                ReservationDate: booking.ReservationDate || now,
                TimeStamp: booking.TimeStamp || now,
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
                // v1.5.3: SellingRate for B2C Net+Commission model
                ...(booking.sellingRate !== undefined && { sellingRate: booking.sellingRate }),
                ...(booking.SellingRate !== undefined && { sellingRate: booking.SellingRate }),
            },
        };

        try {
            const response = await rateGainClient.post("/api/SmartDistribution/CommitReservation", consolidatedPayload);
            return response.data;
        } catch (error: any) {
            console.error("[RateGain] Commit Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }

    /**
     * POST /api/SmartDistribution/CancelReservation
     * Cancel an existing hotel reservation.
     */
    async cancel(payload: any) {
        // Wrap payload in CancelReservation as required by RateGain
        // Also extract BrandCode from nested structure if necessary
        const booking = payload.CancelReservation || payload;

        const wrappedPayload = {
            ...booking,
            DemandCancelId: booking.DemandCancelId || `demand-cancel-${Date.now()}`,
            TimeStamp: booking.TimeStamp || new Date().toISOString(),
            EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
            BrandCode: booking.BrandCode || "N/A",
            PropertyCode: booking.PropertyCode || "N/A"
        };
        console.log(`[RateGain] Cancel Request Payload:`, JSON.stringify(wrappedPayload, null, 2));
        try {
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", wrappedPayload);
            return response.data;
        } catch (error: any) {
            // Log full error response for debugging
            console.error('[RateGain] Cancel Error Details:', error.response?.data);
            console.error('[RateGain] Cancel Error:', error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }

    }

    /**
     * GET /api/SmartDistribution/getSpecialRequests
     * Get list of predefined special request codes.
     */
    async getSpecialRequests() {
        try {
            const response = await rateGainClient.get("/api/SmartDistribution/getSpecialRequests");
            return response.data;
        } catch (error: any) {
            console.error("[RateGain] SpecialRequests Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }
}
