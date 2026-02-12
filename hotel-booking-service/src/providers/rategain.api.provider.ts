import { rateGainClient } from "../clients/rategain.client";
import fs from "fs";
import path from "path";

const logFile = path.join(process.cwd(), "booking-debug.log");
async function logToFile(msg: string) {
    const formattedMsg = `[${new Date().toISOString()}] ${msg}`;

    // Always log to console to ensure visibility in all environments (Vercel, local terminal)
    console.log(formattedMsg);

    // Skip file writing in Vercel/Production to avoid filesystem issues
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        return;
    }

    try {
        await fs.promises.appendFile(logFile, `${formattedMsg}\n`);
    } catch (error) {
        console.error(`[ERROR] Failed to write to log file: ${(error as Error).message}`);
    }
}

export class RateGainApiProvider {
    async precheck(payload: any) {
        // RateGain requires ReservationDate (today) and EchoToken (case sensitive)
        const booking = payload.BookReservation || {};
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                ReservationDate: booking.ReservationDate || new Date().toISOString().split('T')[0],
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`
            }
        };

        try {
            logToFile(`RateGain PreCheck Request Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/PreCheckReservation", consolidatedPayload);
            logToFile(`RateGain PreCheck Success Response: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain PreCheck Error Status: ${error.response?.status}`);
            logToFile(`RateGain PreCheck Error Data: ${JSON.stringify(error.response?.data || error.message, null, 2)}`);
            throw error;
        }
    }

    async commit(payload: any) {
        // RateGain requires ReservationDate (ISO), EchoToken (case sensitive), TimeStamp (ISO), and DemandBookingId
        const booking = payload.BookReservation || {};
        const now = new Date().toISOString();
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
                ReservationDate: booking.ReservationDate || now,
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
                TimeStamp: booking.TimeStamp || now,
                SellingRate: booking.SellingRate,     // Added for v1.5.3 B2C
                Commission: booking.Commission        // Added for v1.5.3 B2C
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
            DemandCancelId: payload.DemandCancelId || `demand-cancel-${Date.now()}`,
            TimeStamp: payload.TimeStamp || new Date().toISOString(),
            EchoToken: payload.EchoToken || payload.Echotoken || `echo-${Date.now()}`
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
