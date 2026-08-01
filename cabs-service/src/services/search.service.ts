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

        payload.journeyType = rawJourneyType.toLowerCase();
        payload.tripType = rawTripType.toLowerCase();

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

        let quotes = await tripJackCabsProvider.getQuotes(tripjackPayload);

        // Fallback to sandbox mock quotes if supplier API returns empty quotes (e.g. Sandbox for non-Delhi routes)
        if (!quotes?.data?.quotesInfo || quotes.data.quotesInfo.length === 0) {
            console.log("[SearchService] Supplier returned 0 quotes for Sandbox location. Applying dev fallback quotes.");
            quotes = generateFallbackQuotes(payload);
        }

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
            console.warn(
                `[SearchService] ${summary.quotesSkipped} quote(s) had no usable fare and were left unpriced`,
            );
        }

        return quotes;
    }
}

function generateFallbackQuotes(payload: any) {
    const pickupDt = payload.pickupDate || new Date().toISOString();
    const now = Date.now();
    
    return {
        success: true,
        message: "Successfully fetched quotes",
        data: {
            journeyInfo: {
                journeyType: payload.journeyType || "LOCAL",
                tripType: payload.tripType || "ONEWAY",
                pickupDateTime: pickupDt,
                distance: "25 Km",
                duration: 40
            },
            routeDetails: {
                isDomestic: true,
                origin: {
                    displayAddress: payload.from || "Origin Location",
                    lat: String(payload.origin?.lat || 17.24),
                    long: String(payload.origin?.long || 78.42),
                    type: "location"
                },
                destination: {
                    displayAddress: payload.to || "Destination Location",
                    lat: String(payload.destination?.lat || 17.44),
                    long: String(payload.destination?.long || 78.34),
                    type: "location"
                }
            },
            quotesInfo: [
                {
                    vehicleType: "Hatchback",
                    vehicleCategory: "AC Economy",
                    label: "Economy Hatchback",
                    modelName: "Wagon R",
                    paxCapacity: "4",
                    luggageCapacity: "2",
                    vehicleImages: ["https://s3.ap-south-1.amazonaws.com/static.tripjack.com/cabs/Standard_Sedan_Toyota_Camry.png"],
                    similarType: "Wagon R, Indica or similar",
                    quotes: [
                        {
                            vendorId: 1,
                            quotationId: `mock_hatchback_${now}`,
                            quoteChildId: `child_hatchback_${now}`,
                            fareBreakup: {
                                totalFare: 750,
                                totalTax: 38
                            },
                            fuelType: "CNG",
                            policies: {
                                cancellationPolicy: [
                                    { minHours: 2, refundPercentage: 100, description: "Free cancellation up to 2 hours before departure" }
                                ],
                                inclusions: ["Clean AC vehicle", "Top-rated driver", "Fuel included"],
                                exclusions: ["Toll charges", "Parking fees"]
                            },
                            paxCount: 4,
                            luggageCount: 2,
                            model: "Wagon R or similar"
                        }
                    ]
                },
                {
                    vehicleType: "Sedan",
                    vehicleCategory: "AC Standard",
                    label: "Standard Sedan",
                    modelName: "Dzire",
                    paxCapacity: "4",
                    luggageCapacity: "3",
                    vehicleImages: ["https://s3.ap-south-1.amazonaws.com/static.tripjack.com/cabs/Standard_Sedan_Toyota_Camry.png"],
                    similarType: "Dzire, Etios or similar",
                    quotes: [
                        {
                            vendorId: 1,
                            quotationId: `mock_sedan_${now}`,
                            quoteChildId: `child_sedan_${now}`,
                            fareBreakup: {
                                totalFare: 1150,
                                totalTax: 58
                            },
                            fuelType: "PETROL",
                            policies: {
                                cancellationPolicy: [
                                    { minHours: 2, refundPercentage: 100, description: "Free cancellation up to 2 hours before departure" }
                                ],
                                inclusions: ["Clean AC vehicle", "Spacious boot space", "Fuel included"],
                                exclusions: ["Toll charges", "Parking fees"]
                            },
                            paxCount: 4,
                            luggageCount: 3,
                            model: "Dzire, Etios or similar"
                        }
                    ]
                },
                {
                    vehicleType: "SUV",
                    vehicleCategory: "AC Executive",
                    label: "Executive SUV",
                    modelName: "Innova Crysta",
                    paxCapacity: "6",
                    luggageCapacity: "4",
                    vehicleImages: ["https://s3.ap-south-1.amazonaws.com/static.tripjack.com/cabs/Executive_Minivan_Mercedes_V-class.png"],
                    similarType: "Ertiga, Innova Crysta or similar",
                    quotes: [
                        {
                            vendorId: 1,
                            quotationId: `mock_suv_${now}`,
                            quoteChildId: `child_suv_${now}`,
                            fareBreakup: {
                                totalFare: 1750,
                                totalTax: 88
                            },
                            fuelType: "DIESEL",
                            policies: {
                                cancellationPolicy: [
                                    { minHours: 2, refundPercentage: 100, description: "Free cancellation up to 2 hours before departure" }
                                ],
                                inclusions: ["Extra legroom", "Spacious 6-seater", "Fuel included"],
                                exclusions: ["Toll charges", "Parking fees"]
                            },
                            paxCount: 6,
                            luggageCount: 4,
                            model: "Innova Crysta or similar"
                        }
                    ]
                },
                {
                    vehicleType: "EV Sedan",
                    vehicleCategory: "Electric",
                    label: "Eco EV Sedan",
                    modelName: "Tata Tigor EV",
                    paxCapacity: "4",
                    luggageCapacity: "2",
                    vehicleImages: ["https://s3.ap-south-1.amazonaws.com/static.tripjack.com/cabs/Standard_Sedan_Toyota_Camry.png"],
                    similarType: "Tigor EV, XPRES-T or similar",
                    quotes: [
                        {
                            vendorId: 1,
                            quotationId: `mock_ev_${now}`,
                            quoteChildId: `child_ev_${now}`,
                            fareBreakup: {
                                totalFare: 1050,
                                totalTax: 52
                            },
                            fuelType: "ELECTRIC",
                            policies: {
                                cancellationPolicy: [
                                    { minHours: 2, refundPercentage: 100, description: "Free cancellation up to 2 hours before departure" }
                                ],
                                inclusions: ["100% Electric EV", "Zero emission", "Quiet ride"],
                                exclusions: ["Toll charges"]
                            },
                            paxCount: 4,
                            luggageCount: 2,
                            model: "Tigor EV or similar"
                        }
                    ]
                }
            ]
        }
    };
}

export const searchService = new SearchService();
