import { rateGainClient } from "../clients/rategain.client";
import fs from "fs";
import path from "path";

const logFile = path.join(process.cwd(), "booking-debug.log");
function logToFile(msg: string) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

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
        // RateGain requires ReservationDate (today), Echotoken (case sensitive), and TimeStamp
        const booking = payload.BookReservation || {};
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                ReservationDate: booking.ReservationDate || new Date().toISOString().split('T')[0],
                Echotoken: booking.Echotoken || booking.EchoToken || `echo-${Date.now()}`,
                TimeStamp: booking.TimeStamp || new Date().toISOString()
            }
        };

        try {
            logToFile(`RateGain Commit Request Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CommitReservation", consolidatedPayload);
            logToFile(`RateGain Commit Success Response: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain Commit Error Status: ${error.response?.status}`);
            logToFile(`RateGain Commit Error Data: ${JSON.stringify(error.response?.data || error.message, null, 2)}`);
            throw error;
        }
    }


    async cancel(payload: any) {
        // RateGain requires TimeStamp and Echotoken for cancel
        const consolidatedPayload = {
            ...payload,
            TimeStamp: payload.TimeStamp || new Date().toISOString(),
            Echotoken: payload.Echotoken || payload.EchoToken || `echo-${Date.now()}`
        };

        try {
            logToFile(`RateGain Cancel Request Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", consolidatedPayload);
            logToFile(`RateGain Cancel Success Response: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain Cancel Error Status: ${error.response?.status}`);
            logToFile(`RateGain Cancel Error Data: ${JSON.stringify(error.response?.data || error.message, null, 2)}`);
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
