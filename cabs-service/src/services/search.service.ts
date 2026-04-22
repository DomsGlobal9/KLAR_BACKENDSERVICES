import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { getCityFromAddress, getCountryFromAddress } from "../utils/location.utils";

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
        payload.journeyType = payload.journeyType || "airport_transfer";
        payload.tripType = payload.tripType || "oneway";

        const pax = Number(payload.passengers);
        if (isNaN(pax) || pax < 1 || pax > 10) {
            payload.passengers = 1;
        }

        // Format for TripJack
        const tripjackPayload = {
            ...payload,
            origin: {
                type: "location",
                lat: String(payload.origin.lat),
                long: String(payload.origin.long),
                displayAddress: payload.from || "Pickup Location",
                address: { 
                    city: getCityFromAddress(payload.from), 
                    country: getCountryFromAddress(payload.from) 
                }
            },
            destination: {
                type: "location",
                lat: String(payload.destination.lat),
                long: String(payload.destination.long),
                displayAddress: payload.to || "Drop Location",
                address: { 
                    city: getCityFromAddress(payload.to), 
                    country: getCountryFromAddress(payload.to) 
                }
            }
        };

        return await tripJackCabsProvider.getQuotes(tripjackPayload);
    }
}

export const searchService = new SearchService();
