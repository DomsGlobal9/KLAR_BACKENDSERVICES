import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {

    /**
     * POST /api/SmartDistribution/PreCheckReservation
     * Validate rate and availability before committing a booking.
     */
    async precheck(payload: any) {
        const booking = payload.BookReservation || {};
        const rawPropertyId = (booking.propertyID || booking.PropertyId || booking.propertyId || booking.PropertyCode || "").toString().replace(/^RG:/, "");
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                propertyID: rawPropertyId, // v1.5.3 uses propertyID (capital ID)
                PropertyId: rawPropertyId,
                PropertyCode: booking.PropertyCode || rawPropertyId,
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`, // v1.5.3 uses EchoToken
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

        const rawPropertyId = (booking.propertyID || booking.PropertyId || booking.propertyId || booking.PropertyCode || "").toString().replace(/^RG:/, "");
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                propertyID: rawPropertyId, // v1.5.3 uses propertyID (capital ID)
                PropertyId: rawPropertyId,
                PropertyCode: booking.PropertyCode || rawPropertyId,
                DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
                ReservationDate: booking.ReservationDate || now,
                TimeStamp: booking.TimeStamp || now,
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`, // v1.5.3 uses EchoToken
                // v1.5.3: SellingRate for B2C Net+Commission model. Spec uses both cases, supporting both.
                SellingRate: booking.SellingRate || booking.sellingRate,
                sellingRate: booking.sellingRate || booking.SellingRate,
                RoomSelection: (booking.RoomSelection || []).map((rs: any) => ({
                    ...rs,
                    NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
                    NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
                    NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
                }))
            },
        };

        try {
            console.log(`[RateGain] Requesting Commit: ${JSON.stringify(consolidatedPayload, null, 2)}`);
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
        const booking = payload.CancelReservation || payload;
        const rawPropertyId = (booking.PropertyId || booking.propertyId || booking.propertyID || "").toString().replace(/^RG:/, "");

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

        try {
            console.log(`[RateGain] Requesting Cancel: ${JSON.stringify(unwrappedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", unwrappedPayload);
            return response.data;
        } catch (error: any) {
            console.error("[RateGain] Cancel Error:", error.response?.status, error.response?.data?.description || error.message);
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
