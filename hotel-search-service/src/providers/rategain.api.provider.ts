import { rateGainClient } from "../clients/rategain.client";
import fs from "fs";
import path from "path";

const logFile = path.join(process.cwd(), "debug.log");
function logToFile(msg: string) {
    const formattedMsg = `[${new Date().toISOString()}] ${msg}`;

    // Always log to console in Vercel or if file logging fails
    if (process.env.VERCEL) {
        console.log(formattedMsg);
        return;
    }

    try {
        fs.appendFileSync(logFile, `${formattedMsg}\n`);
    } catch (error) {
        console.log(formattedMsg);
        console.error(`[ERROR] Failed to write to log file: ${(error as Error).message}`);
    }
}

export class RateGainApiProvider {
    async getDestinations() {
        try {
            logToFile("Fetching RateGain Destinations...");
            const res = await rateGainClient.get(
                "/api/SmartDistribution/getDestinations"
            );
            logToFile(`RateGain Destinations Success: ${JSON.stringify(res.data).substring(0, 100)}...`);
            return res.data;
        } catch (error: any) {
            logToFile(`RateGain GetDestinations Error: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async getBestProperties(payload: any) {
        logToFile(`[DEBUG] Raw Input Payload to getBestProperties: ${JSON.stringify(payload)}`);
        // Build the exact payload format required by RateGain API v1.5.2
        const rateGainPayload = {
            destinationCode: payload.destinationCode || payload.destCode,
            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            CountryCode: payload.CountryCode || payload.countryCode || "US",
            Currency: payload.Currency || payload.currency || "USD",
            Rooms: (payload.Rooms || payload.rooms || [{}]).map((r: any) => ({
                NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || r.rooms || 1,
                adults: r.Adults || r.adults || 2,
                children: r.Children || r.children || 0,
                // Add paxes if children > 0
                ...((r.Children > 0 || r.children > 0 || r.paxes?.length > 0) ? {
                    paxes: r.paxes || r.childrenAges?.map((age: number) => ({ type: "Child", age })) || [{ type: "Child", age: 5 }]
                } : {})
            })),
            pageNo: payload.pageNo || 1,
            Echotoken: payload.Echotoken || payload.echoToken || `echo-${Date.now()}`
        };

        try {
            logToFile(`RateGain Search Payload: ${JSON.stringify(rateGainPayload, null, 2)}`);
            const res = await rateGainClient.post(
                "/api/SmartDistribution/bestproperties",
                rateGainPayload
            );
            logToFile(`RateGain Search Success: ${JSON.stringify(res.data, null, 2)}`);
            return res.data;
        } catch (error: any) {
            logToFile(`RateGain Search Error Status: ${error.response?.status}`);
            logToFile(`RateGain Search Error Response: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async getAllProducts(payload: any) {
        // Build strict payload for getProducts API (v1.5.2)
        const rateGainPayload = {
            propertyID: payload.propertyID || payload.propertyId, // Mandatory
            PropertyCode: payload.PropertyCode || payload.propertyCode, // Mandatory - NOT same as propertyID
            BrandCode: payload.BrandCode || payload.brandCode, // Mandatory

            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            CountryCode: payload.CountryCode || payload.countryCode || "US",
            Currency: payload.Currency || payload.currency || "USD",

            Rooms: (payload.Rooms || payload.rooms || [{}]).map((r: any) => ({
                numberOfRoom: r.numberOfRoom || r.NumberOfRoom || r.rooms || 1,
                adults: r.Adults || r.adults || 2,
                children: r.Children || r.children || 0,
                // Add paxes if children > 0
                ...((r.Children > 0 || r.children > 0 || r.paxes?.length > 0) ? {
                    paxes: r.paxes || r.childrenAges?.map((age: number) => ({ type: "Child", age })) || [{ type: "Child", age: 5 }]
                } : {})
            })),

            echoToken: payload.echoToken || payload.Echotoken || `echo-${Date.now()}`
        };

        try {
            logToFile(`RateGain Products Payload: ${JSON.stringify(rateGainPayload, null, 2)}`);
            const res = await rateGainClient.post(
                "/api/SmartDistribution/getproducts",
                rateGainPayload
            );
            logToFile(`RateGain Products Success: ${JSON.stringify(res.data, null, 2)}`);
            return res.data;
        } catch (error: any) {
            logToFile(`RateGain Products Error Status: ${error.response?.status}`);
            logToFile(`RateGain Products Error Response: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

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
            logToFile(`RateGain PreCheck Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/PreCheckReservation", consolidatedPayload);
            logToFile(`RateGain PreCheck Success: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain PreCheck Error: ${JSON.stringify(error.response?.data || error.message)}`);
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
            logToFile(`RateGain Commit Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CommitReservation", consolidatedPayload);
            logToFile(`RateGain Commit Success: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain Commit Error: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async cancel(payload: any) {
        const consolidatedPayload = {
            ...payload,
            Echotoken: payload.Echotoken || payload.EchoToken || `echo-${Date.now()}`
        };

        try {
            logToFile(`RateGain Cancel Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", consolidatedPayload);
            logToFile(`RateGain Cancel Success: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain Cancel Error: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async getSpecialRequests() {
        try {
            logToFile("Fetching RateGain SpecialRequests...");
            const response = await rateGainClient.get("/api/SmartDistribution/getSpecialRequests");
            logToFile("RateGain SpecialRequests Success");
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain SpecialRequests Error: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }
}
