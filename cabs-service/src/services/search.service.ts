import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { resolveAddress } from "../utils/location.utils";
import { deriveRegion } from "../utils/region.util";
import { resolveMarkupRules } from "../utils/wallet.util";
import { applyMarkupToQuotes } from "../utils/quotePricing.util";

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

    /**
     * `clientType` and `token` decide which channel's margin is applied, and
     * must come from the request's auth context — never from the body.
     */
    async getQuotes(payload: any, clientType?: string, token?: string) {
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

        // Resolve real address data (city/country/postalCode) dynamically via
        // TripJack's location APIs when the client didn't send a complete one —
        // the quotes API 404s ("No Cabs Found!") on guessed city/country.
        const [originAddress, destinationAddress] = await Promise.all([
            payload.origin.address?.city && payload.origin.address?.country
                ? payload.origin.address
                : resolveAddress(payload.from),
            payload.destination.address?.city && payload.destination.address?.country
                ? payload.destination.address
                : resolveAddress(payload.to),
        ]);

        // Format for TripJack
        const tripjackPayload = {
            ...payload,
            origin: {
                type: "location",
                lat: String(payload.origin.lat),
                long: String(payload.origin.long),
                displayAddress: payload.from || "Pickup Location",
                address: originAddress
            },
            destination: {
                type: "location",
                lat: String(payload.destination.lat),
                long: String(payload.destination.long),
                displayAddress: payload.to || "Drop Location",
                address: destinationAddress
            }
        };

        const quotes = await tripJackCabsProvider.getQuotes(tripjackPayload);

        // Price the quotes with the SAME rules booking will charge with.
        // Returning the bare supplier fare here would show the customer one
        // number and charge another at commit.
        //
        // The region comes from the resolved pickup address, which is derived
        // server-side above — never from anything the caller sent.
        const region = deriveRegion(originAddress?.country);
        const agentRules = await resolveMarkupRules(clientType, token || "", region);
        const summary = applyMarkupToQuotes(quotes, {
            clientType,
            agentRules,
            region,
        });

        if (summary.quotesSkipped > 0) {
            // A quote we could not price is served at supplier net; booking will
            // still charge the marked-up gross, so this is the one place that
            // gap can originate.
            console.warn(
                `[SearchService] ${summary.quotesSkipped} quote(s) had no usable fare and were left unpriced`,
            );
        }

        return quotes;
    }
}

export const searchService = new SearchService();
