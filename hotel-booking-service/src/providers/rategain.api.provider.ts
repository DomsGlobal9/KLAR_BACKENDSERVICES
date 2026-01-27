import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {
    async precheck(payload: any) {
        try {
            const response = await rateGainClient.post("/api/SmartDistribution/PreCheckReservation", payload);
            return response.data;
        } catch (error: any) {
            console.error("RateGain PreCheck Error:", error.response?.data || error.message);
            throw error;
        }
    }

    async commit(payload: any) {
        try {
            console.log("RateGain Commit Request Payload:", JSON.stringify(payload, null, 2));
            const response = await rateGainClient.post("/api/SmartDistribution/CommitReservation", payload);
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
