import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {
    async precheck(payload: any) {
        // RateGain requires ReservationDate (today) and Echotoken (case sensitive)
        const booking = payload.BookReservation || {};
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                ReservationDate: booking.ReservationDate || new Date().toISOString().split('T')[0],
                Echotoken: booking.Echotoken || booking.EchoToken || `echo-${Date.now()}`
            }
        };

        try {
            console.log("RateGain PreCheck Payload:", JSON.stringify(consolidatedPayload, null, 2));
            const response = await rateGainClient.post("/api/SmartDistribution/PreCheckReservation", consolidatedPayload);
            console.log("RateGain PreCheck Success:", JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error: any) {
            console.error("RateGain PreCheck Error:", error.response?.data || error.message);
            throw error;
        }
    }

    async commit(payload: any) {
        // RateGain requires ReservationDate (today) and Echotoken (case sensitive)
        const booking = payload.BookReservation || {};
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                ReservationDate: booking.ReservationDate || new Date().toISOString().split('T')[0],
                Echotoken: booking.Echotoken || booking.EchoToken || `echo-${Date.now()}`
            }
        };

        try {
            console.log("RateGain Commit Request Payload:", JSON.stringify(consolidatedPayload, null, 2));
            const response = await rateGainClient.post("/api/SmartDistribution/CommitReservation", consolidatedPayload);
            console.log("RateGain Commit Success Response:", JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error: any) {
            console.error("RateGain Commit Error Status:", error.response?.status);
            console.error("RateGain Commit Error Data:", JSON.stringify(error.response?.data || error.message, null, 2));
            throw error;
        }
    }


    async cancel(payload: any) {
        try {
            console.log("RateGain Cancel Request Payload:", JSON.stringify(payload, null, 2));
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", payload);
            console.log("RateGain Cancel Success Response:", JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error: any) {
            console.error("RateGain Cancel Error Status:", error.response?.status);
            console.error("RateGain Cancel Error Data:", JSON.stringify(error.response?.data || error.message, null, 2));
            throw error;
        }
    }


    async getSpecialRequests() {
        try {
            const response = await rateGainClient.get("/api/SmartDistribution/getSpecialRequests");
            return response.data;
        } catch (error: any) {
            console.error("RateGain SpecialRequests Error:", error.response?.data || error.message);
            throw error;
        }
    }
}
