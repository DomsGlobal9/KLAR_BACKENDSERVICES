import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { QuoteRequest } from "../models/tripjack.types";

class SearchService {
    async locationSearch(input: string) {
        if (!input || input.trim().length < 2) {
            throw { status: 400, message: "Search input must be at least 2 characters" };
        }
        return await tripJackCabsProvider.googlePlaces(input);
    }

    async getLatLong(placeId: string) {
        if (!placeId) throw { status: 400, message: "placeId is required" };
        return await tripJackCabsProvider.getLatLong(placeId);
    }

    async getQuotes(payload: QuoteRequest) {
        // Robust validation
        if (!payload.pickupDate) throw { status: 400, message: "pickupDate is required (YYYY-MM-DD HH:mm)" };
        if (!payload.origin?.lat || !payload.origin?.long) {
            throw { status: 400, message: "Origin coordinates (lat/long) are required" };
        }
        if (!payload.destination?.lat || !payload.destination?.long) {
            throw { status: 400, message: "Destination coordinates (lat/long) are required" };
        }
        
        // Logical defaults
        payload.journeyType = payload.journeyType || "airport_transfer";
        payload.tripType = payload.tripType || "oneway";
        
        const pax = Number(payload.passengers);
        if (isNaN(pax) || pax < 1 || pax > 10) {
            payload.passengers = 1; 
        }

        return await tripJackCabsProvider.getQuotes(payload);
    }
}

export const searchService = new SearchService();
