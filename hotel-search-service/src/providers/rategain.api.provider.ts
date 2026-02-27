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
            Echotoken: payload.Echotoken || payload.echoToken || `echo-${Date.now()}`,
            Rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
                const adultsCount = r.Adults || r.adults || 2;
                const childrenCount = r.Children || r.children || 0;
                const childrenAges: number[] = r.childrenAges || r.paxes?.filter((p: any) => p.type === "Child").map((p: any) => p.age) || [];

                const room: any = {
                    NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || 1,
                    Adults: adultsCount,
                    Children: childrenCount,
                };

                if (childrenCount > 0) {
                    room.paxes = childrenAges.length > 0
                        ? childrenAges.map((age: number) => ({ type: "Child", age: age || 5 }))
                        : Array(childrenCount).fill({ type: "Child", age: 5 });
                }

                return room;
            }),
            pageNo: payload.pageNo || 1,
        };

        // Optional fields per spec
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
        const rateGainPayload: any = {
            propertyID: payload.propertyID || payload.propertyId,
            PropertyCode: payload.PropertyCode || payload.propertyCode,
            BrandCode: payload.BrandCode || payload.brandCode,
            checkin: payload.checkin || payload.checkIn,
            checkout: payload.checkout || payload.checkOut,
            Rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
                const childrenCount = r.children || r.Children || 0;
                const childrenAges: number[] = r.childrenAges || r.paxes?.filter((p: any) => p.type === "Child").map((p: any) => p.age) || [];

                const room: any = {
                    numberOfRoom: r.numberOfRoom || r.NumberOfRoom || 1,
                    adults: r.adults || r.Adults || 2,
                    children: childrenCount,
                };

                if (childrenCount > 0) {
                    room.paxes = childrenAges.length > 0
                        ? childrenAges.map((age: number) => ({ type: "Child", age: age || 5 }))
                        : Array(childrenCount).fill({ type: "Child", age: 5 });
                }

                return room;
            }),
            echoToken: payload.echoToken || payload.Echotoken || `echo-${Date.now()}`,
        };

        // Optional fields
        if (payload.CountryCode || payload.countryCode) {
            rateGainPayload.CountryCode = payload.CountryCode || payload.countryCode;
        }
        if (payload.Currency || payload.currency) {
            rateGainPayload.Currency = payload.Currency || payload.currency;
        }

        try {
            const res = await rateGainClient.post("/api/SmartDistribution/getproducts", rateGainPayload);
            return res.data;
        } catch (error: any) {
            console.error("[RateGain] GetProducts Error:", error.response?.status, error.response?.data?.description || error.message);
            throw error;
        }
    }
}
