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
            Echotoken: payload.Echotoken || payload.echotoken || payload.echoToken || `echo-${Date.now()}`,
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

                return {
                    NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || 1,
                    Adults: adultsCount,
                    Children: childrenCount,
                    paxes: paxes,
                };
            }),
            pageNo: payload.pageNo || 1,
        };

        const propertyId = payload.PropertyId || payload.propertyId || payload.propertyID;
        if (propertyId) {
            rateGainPayload.PropertyId = propertyId;
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
        const propertyId = (payload.PropertyId || payload.propertyID || payload.propertyId || "").toString().replace("RG:", "");
        const rateGainPayload: any = {
            propertyID: propertyId, // v1.5.3 spec uses propertyID (capital ID)
            PropertyCode: payload.PropertyCode || payload.propertyCode,
            BrandCode: payload.BrandCode || payload.brandCode,
            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            CountryCode: payload.CountryCode || payload.countryCode,
            Currency: payload.Currency || payload.currency,
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

                return {
                    numberOfRoom: r.numberOfRoom || r.NumberOfRoom || 1, // v1.5.3 spec uses numberOfRoom (lowercase n)
                    adults: adultsCount, // v1.5.3 spec uses adults (lowercase a)
                    children: childrenCount, // v1.5.3 spec uses children (lowercase c)
                    paxes: paxes,
                };
            }),
            echoToken: payload.echoToken || payload.echotoken || payload.Echotoken || `echo-${Date.now()}`, // v1.5.3 spec uses echoToken (lowercase e, capital T)
        };

        if (payload.destinationCode || payload.destCode) {
            rateGainPayload.destinationCode = payload.destinationCode || payload.destCode;
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
