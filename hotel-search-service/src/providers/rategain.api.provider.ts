import { rateGainClient } from "../clients/rategain.client";
import fs from "fs";
import path from "path";

const logFile = path.join(process.cwd(), "debug.log");
function logToFile(msg: string) {
    const formattedMsg = `[${new Date().toISOString()}] ${msg}`;

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
            const res = await rateGainClient.get("/api/SmartDistribution/getDestinations");
            logToFile(`RateGain Destinations Success: ${JSON.stringify(res.data).substring(0, 100)}...`);
            return res.data;
        } catch (error: any) {
            logToFile(`RateGain GetDestinations Error: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async getBestProperties(payload: any) {
        logToFile(`[DEBUG] Raw Input Payload to getBestProperties: ${JSON.stringify(payload)}`);

        // Build payload per RateGain API v1.5.3 spec
        const rateGainPayload: any = {
            destinationCode: payload.destinationCode || payload.destCode,
            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            Echotoken: payload.Echotoken || payload.echoToken || `echo-${Date.now()}`,
            Rooms: (payload.Rooms || payload.rooms || [{}]).map((r: any) => {
                const adultsCount = r.Adults || r.adults || 2;
                const childrenCount = r.Children || r.children || 0;
                const childrenAges: number[] = r.childrenAges || r.paxes?.filter((p: any) => p.type === "Child").map((p: any) => p.age) || [];

                const room: any = {
                    NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || 1,
                    Adults: adultsCount,
                    Children: childrenCount,
                };

                // Spec: paxes only required when children > 0, adult paxes are NOT required
                if (childrenCount > 0) {
                    const childPaxes = childrenAges.length > 0
                        ? childrenAges.map((age: number) => ({ type: "Child", age: age || 5 }))
                        : Array(childrenCount).fill({ type: "Child", age: 5 });
                    room.paxes = childPaxes;
                }

                return room;
            }),
            pageNo: payload.pageNo || 1,
        };

        // Optional fields — only include if provided
        if (payload.CountryCode || payload.countryCode) {
            rateGainPayload.CountryCode = payload.CountryCode || payload.countryCode;
        }
        if (payload.Currency || payload.currency) {
            rateGainPayload.Currency = payload.Currency || payload.currency;
        }
        if (payload.starRating) {
            rateGainPayload.starRating = payload.starRating;
        }
        if (payload.PropertyId || payload.propertyId) {
            rateGainPayload.PropertyId = payload.PropertyId || payload.propertyId;
        }
        if (payload.Geofilter) {
            rateGainPayload.Geofilter = payload.Geofilter;
        }

        try {
            logToFile(`RateGain Search Payload: ${JSON.stringify(rateGainPayload, null, 2)}`);
            const res = await rateGainClient.post("/api/SmartDistribution/bestproperties", rateGainPayload);
            logToFile(`RateGain Search Success: ${JSON.stringify(res.data, null, 2)}`);
            return res.data;
        } catch (error: any) {
            logToFile(`RateGain Search Error Status: ${error.response?.status}`);
            logToFile(`RateGain Search Error Response: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async getAllProducts(payload: any) {
        // Build strict payload for getproducts API per v1.5.3 spec
        const rateGainPayload: any = {
            propertyID: payload.propertyID || payload.propertyId, // Required
            PropertyCode: payload.PropertyCode || payload.propertyCode, // Required
            BrandCode: payload.BrandCode || payload.brandCode, // Required
            checkin: payload.checkin || payload.checkIn,       // Required
            checkout: payload.checkout || payload.checkOut,    // Required
            Rooms: (payload.Rooms || payload.rooms || [{}]).map((r: any) => {
                const childrenCount = r.children || r.Children || 0;
                const childrenAges: number[] = r.childrenAges || r.paxes?.filter((p: any) => p.type === "Child").map((p: any) => p.age) || [];

                const room: any = {
                    numberOfRoom: r.numberOfRoom || r.NumberOfRoom || 1,
                    adults: r.adults || r.Adults || 2,
                    children: childrenCount,
                };

                // Spec: paxes required if children > 0
                if (childrenCount > 0) {
                    room.paxes = childrenAges.length > 0
                        ? childrenAges.map((age: number) => ({ type: "Child", age: age || 5 }))
                        : Array(childrenCount).fill({ type: "Child", age: 5 });
                }

                return room;
            }),
            echoToken: payload.echoToken || payload.Echotoken || `echo-${Date.now()}`,
        };

        // Optional fields — only include if provided
        if (payload.CountryCode || payload.countryCode) {
            rateGainPayload.CountryCode = payload.CountryCode || payload.countryCode;
        }
        if (payload.Currency || payload.currency) {
            rateGainPayload.Currency = payload.Currency || payload.currency;
        }

        try {
            logToFile(`RateGain Products Payload: ${JSON.stringify(rateGainPayload, null, 2)}`);
            const res = await rateGainClient.post("/api/SmartDistribution/getproducts", rateGainPayload);
            logToFile(`RateGain Products Success: ${JSON.stringify(res.data, null, 2)}`);
            return res.data;
        } catch (error: any) {
            logToFile(`RateGain Products Error Status: ${error.response?.status}`);
            logToFile(`RateGain Products Error Response: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async precheck(payload: any) {
        // Build PreCheckReservation payload per v1.5.3 spec
        const booking = payload.BookReservation || {};
        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                ReservationDate: booking.ReservationDate || new Date().toISOString().split("T")[0],
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
            },
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
        // Build CommitReservation payload per v1.5.3 spec
        const booking = payload.BookReservation || {};
        const now = new Date().toISOString();

        const consolidatedPayload = {
            BookReservation: {
                ...booking,
                // Required fields — auto-fill if not provided
                DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
                ReservationDate: booking.ReservationDate || now,
                TimeStamp: booking.TimeStamp || now,
                EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
                // v1.5.3: SellingRate for B2C Net+Commission model (pass through if provided)
                ...(booking.SellingRate !== undefined && { SellingRate: booking.SellingRate }),
                ...(booking.sellingRate !== undefined && { SellingRate: booking.sellingRate }),
            },
        };

        try {
            logToFile(`RateGain Commit Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CommitReservation", consolidatedPayload);
            logToFile(`RateGain Commit Success: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain Commit Error Status: ${error.response?.status}`);
            logToFile(`RateGain Commit Error Data: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    async cancel(payload: any) {
        // Build CancelReservation payload per v1.5.3 spec
        const consolidatedPayload = {
            ...payload,
            DemandCancelId: payload.DemandCancelId || `demand-cancel-${Date.now()}`,
            TimeStamp: payload.TimeStamp || new Date().toISOString(),
            EchoToken: payload.EchoToken || payload.Echotoken || `echo-${Date.now()}`,
        };

        try {
            logToFile(`RateGain Cancel Payload: ${JSON.stringify(consolidatedPayload, null, 2)}`);
            const response = await rateGainClient.post("/api/SmartDistribution/CancelReservation", consolidatedPayload);
            logToFile(`RateGain Cancel Success: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error: any) {
            logToFile(`RateGain Cancel Error Status: ${error.response?.status}`);
            logToFile(`RateGain Cancel Error Data: ${JSON.stringify(error.response?.data || error.message)}`);
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
