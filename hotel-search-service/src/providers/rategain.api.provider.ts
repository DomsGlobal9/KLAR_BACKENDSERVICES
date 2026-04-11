import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {

    /**
     * GET /api/SmartDistribution/getDestinations
     * Returns list of all available destination codes.
     */
    async getDestinations() {
        try {
            const res = await rateGainClient.get("/api/SmartDistribution/getDestinations");
            return res.data;
        } catch (error: any) {
            console.error("[RateGain] GetDestinations Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }

    /**
     * POST /api/SmartDistribution/bestproperties
     * Search for best available hotel properties in a destination.
     */
    async getBestProperties(payload: any) {
        const rateGainPayload: any = {
            destinationCode: payload.destinationCode || payload.destCode,
            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            // v1.5.3: Echotoken (capital E)
            Echotoken: payload.echotoken || payload.Echotoken || payload.echoToken || `echo-${Date.now()}`,
            Rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
                const adultsCount = r.adults || r.Adults || 2;
                const childrenCount = r.children || r.Children || 0;

                // If paxes is already provided in the correct format, use it. Otherwise, derive from childrenAges or children count.
                let paxes = r.paxes || [];
                if (childrenCount > 0 && paxes.length === 0) {
                    const childrenAges: number[] = r.childrenAges || [];
                    if (childrenAges.length > 0) {
                        paxes = childrenAges.map((age: number) => ({ type: "Child", age: age || 5 }));
                    } else {
                        paxes = Array(childrenCount).fill(0).map(() => ({ type: "Child", age: 5 }));
                    }
                }

                const room: any = {
                    NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || 1,
                    Adults: adultsCount,
                    Children: childrenCount,
                    paxes: paxes,
                };

                return room;
            }),
            pageNo: payload.pageNo || 1,
        };

        // Optional fields per spec - Ensure PropertyId is correctly named for TC3
        if (payload.PropertyId || payload.propertyId || payload.propertyID) {
            rateGainPayload.PropertyId = payload.PropertyId || payload.propertyId || payload.propertyID;
        }
        if (payload.CountryCode || payload.countryCode) {
            rateGainPayload.CountryCode = payload.CountryCode || payload.countryCode;
        }
        if (payload.Currency || payload.currency) {
            rateGainPayload.Currency = payload.Currency || payload.currency;
        }
        if (payload.starRating) {
            rateGainPayload.starRating = payload.starRating;
        }
        if (payload.Geofilter) {
            rateGainPayload.Geofilter = payload.Geofilter;
        }

        try {
            console.log(`[RateGain] Requesting Best Properties: ${JSON.stringify(rateGainPayload, null, 2)}`);
            const res = await rateGainClient.post("/api/SmartDistribution/bestproperties", rateGainPayload);
            return res.data;
        } catch (error: any) {
            console.error("[RateGain] BestProperties Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }

    /**
     * POST /api/SmartDistribution/getproducts
     * Get room-level product details for a specific property.
     */
    async getAllProducts(payload: any) {
        const propertyId = (payload.propertyID || payload.propertyId || payload.PropertyId || "").toString().replace("RG:", "");
        const rateGainPayload: any = {
            propertyID: propertyId,
            PropertyCode: payload.PropertyCode || payload.propertyCode,
            BrandCode: payload.BrandCode || payload.brandCode,
            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            destinationCode: payload.destinationCode || payload.destCode,
            Rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
                const adultsCount = r.adults || r.Adults || 2;
                const childrenCount = r.children || r.Children || 0;

                let paxes = r.paxes || [];
                if (childrenCount > 0 && paxes.length === 0) {
                    const childrenAges: number[] = r.childrenAges || [];
                    if (childrenAges.length > 0) {
                        paxes = childrenAges.map((age: number) => ({ type: "Child", age: age || 5 }));
                    } else {
                        paxes = Array(childrenCount).fill(0).map(() => ({ type: "Child", age: 5 }));
                    }
                }

                const room: any = {
                    NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || 1,
                    Adults: adultsCount,
                    Children: childrenCount,
                    paxes: paxes,
                };

                return room;
            }),
            EchoToken: payload.echotoken || payload.echoToken || payload.Echotoken || `echo-${Date.now()}`,
        };

        // Optional fields
        if (payload.CountryCode || payload.countryCode) {
            rateGainPayload.CountryCode = payload.CountryCode || payload.countryCode;
        }
        if (payload.Currency || payload.currency) {
            rateGainPayload.Currency = payload.Currency || payload.currency;
        }

        try {
            console.log(`[RateGain] Requesting Products: ${JSON.stringify(rateGainPayload, null, 2)}`);
            const res = await rateGainClient.post("/api/SmartDistribution/getproducts", rateGainPayload);
            return res.data;
        } catch (error: any) {
            console.error("[RateGain] GetProducts Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }
}
