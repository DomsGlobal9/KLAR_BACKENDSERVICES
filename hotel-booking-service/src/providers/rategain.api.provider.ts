import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {

    /**
     * POST /api/SmartDistribution/PreCheckReservation
     * Validate rate and availability before committing a booking.
     */
    async precheck(payload: any) {
        const booking = payload.BookReservation || {};
        const rawPropertyId = (booking.PropertyId || booking.propertyID || booking.propertyId || booking.PropertyCode || "").toString().replace(/^RG:/, "");
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                PropertyId: rawPropertyId,
                PropertyCode: booking.PropertyCode || rawPropertyId,
                Echotoken: booking.Echotoken || booking.EchoToken || `echo-${Date.now()}`,
                RoomSelection: (booking.RoomSelection || []).map((rs: any) => ({
                    ...rs,
                    NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
                    NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
                    NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
                }))
            },
        };

        try {
            console.log(`[RateGain] Requesting PreCheck: ${JSON.stringify(consolidatedPayload, null, 2)}`);
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

        const rawPropertyId = (booking.PropertyId || booking.propertyID || booking.propertyId || booking.PropertyCode || "").toString().replace(/^RG:/, "");
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                PropertyId: rawPropertyId,
                PropertyCode: booking.PropertyCode || rawPropertyId,
                DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
                ReservationDate: booking.ReservationDate || now,
                TimeStamp: booking.TimeStamp || now,
                Echotoken: booking.Echotoken || booking.EchoToken || `echo-${Date.now()}`,
                // v1.5.3: SellingRate (capital S) for B2C Net+Commission model
                SellingRate: booking.SellingRate || booking.sellingRate,
                RoomSelection: (booking.RoomSelection || []).map((rs: any) => ({
                    ...rs,
                    NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
                    NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
                    NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
                }))
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
        // RateGain CancelReservation usually expects fields at top level, not wrapped.
        const booking = payload.CancelReservation || payload;

        const rawPropertyId = (booking.PropertyId || booking.propertyId || "").toString().replace(/^RG:/, "");

        const unwrappedPayload = {
            ConfirmationNumber: booking.ConfirmationNumber || booking.confirmationNumber || booking.confirmationId,
            ReservationId: booking.ReservationId || booking.reservationId || booking.reservationid,
            DemandCancelId: booking.DemandCancelId || `demand-cancel-${Date.now()}`,
            TimeStamp: booking.TimeStamp || new Date().toISOString(),
            EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
            BrandCode: booking.BrandCode || booking.brandCode || "N/A",
            PropertyCode: booking.PropertyCode || rawPropertyId || "N/A",
            PropertyId: rawPropertyId
        };

        console.log(`[RateGain] Cancel Request Payload (Unwrapped):`, JSON.stringify(unwrappedPayload, null, 2));
        
        try {
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", unwrappedPayload);
            
            // Handle case where RateGain returns error message with 200/500 code in body
            const data = response.data;
            if (data && (data.Message || data.description) && (data.StatusCode !== 200 || data.status === false)) {
                console.error('[RateGain] Cancel Application Error:', data);
            }
            
            return data;
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
