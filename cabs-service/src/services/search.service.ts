import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { getCityFromAddress, getCountryFromAddress } from "../utils/location.utils";

const locationCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache for locations

class SearchService {
    async locationSearch(input: string) {
        if (!input || input.trim().length < 2) {
            throw { status: 400, message: "Search input must be at least 2 characters" };
        }
        
        const cacheKey = input.trim().toLowerCase();
        const cached = locationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        let lastError;
        for (let i = 0; i < 2; i++) {
            try {
                const data = await tripJackCabsProvider.googlePlaces(input);
                locationCache.set(cacheKey, { timestamp: Date.now(), data });
                return data;
            } catch (err) {
                lastError = err;
                console.warn(`[SearchService] Location search retry ${i + 1} for: ${input}`);
                await new Promise(resolve => setTimeout(resolve, 500)); // sleep 500ms
            }
        }
        throw lastError;
    }

    async getLatLong(placeId: string) {
        if (!placeId) throw { status: 400, message: "placeId is required" };
        
        let lastError;
        for (let i = 0; i < 2; i++) {
            try {
                return await tripJackCabsProvider.getLatLong(placeId);
            } catch (err) {
                lastError = err;
                console.warn(`[SearchService] GetLatLong retry ${i + 1} for: ${placeId}`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        throw lastError;
    }

    async getQuotes(payload: any) {
        // Robust validation
        if (!payload.pickupDate) throw { status: 400, message: "pickupDate is required (YYYY-MM-DD HH:mm)" };
        if (!payload.origin?.lat || !payload.origin?.long) {
            throw { status: 400, message: "Origin coordinates (lat/long) are required" };
        }
        if (!payload.destination?.lat || !payload.destination?.long) {
            throw { status: 400, message: "Destination coordinates (lat/long) are required" };
        }

        // Logical defaults
        const rawJourneyType = payload.journeyType || "airport_transfer";
        const rawTripType = payload.tripType || "oneway";

        payload.journeyType = rawJourneyType.toUpperCase();
        payload.tripType = rawTripType.toUpperCase();

        const pax = Number(payload.passengers) || 1;
        payload.passengers = pax;
        payload.quoteFilter = { paxCount: pax };

        // Format for TripJack
        const tripjackPayload = {
            ...payload,
            origin: {
                type: "location",
                lat: String(payload.origin.lat),
                long: String(payload.origin.long),
                displayAddress: payload.from || "Pickup Location",
                address: { 
                    city: payload.origin.address?.city || getCityFromAddress(payload.from), 
                    country: payload.origin.address?.country || getCountryFromAddress(payload.from) || "India"
                }
            },
            destination: {
                type: "location",
                lat: String(payload.destination.lat),
                long: String(payload.destination.long),
                displayAddress: payload.to || "Drop Location",
                address: { 
                    city: payload.destination.address?.city || getCityFromAddress(payload.to), 
                    country: payload.destination.address?.country || getCountryFromAddress(payload.to) || "India"
                }
            }
        };

        return await tripJackCabsProvider.getQuotes(tripjackPayload);
    }
}

export const searchService = new SearchService();
