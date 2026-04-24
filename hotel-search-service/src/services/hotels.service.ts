import { searchRG } from "../adapters/rateGainAdapter";
import { searchTJ } from "../adapters/tripJackAdapter";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { HotelModel } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";

class HotelsService {
    async searchHotels(searchPayload: UnifiedSearchRequest) {
        const mode = process.env.HOTEL_PROVIDER_MODE || "UNIFIED";
        console.log(`[DEBUG] searchHotels triggered. Mode: ${mode}`);
        const promises = [];

        if (mode === "UNIFIED" || mode === "RG_ONLY") {
            promises.push(searchRG(searchPayload).then(res => ({ type: "RG", value: res })));
        }
        if (mode === "UNIFIED" || mode === "TJ_ONLY") {
            const tjStart = Date.now();
            promises.push(searchTJ(searchPayload).then(res => {
                console.log(`[DEBUG] TJ Search finished in ${Date.now() - tjStart}ms, results: ${res.length}`);
                return { type: "TJ", value: res };
            }));
        } else {
            console.log(`[DEBUG] TJ Search SKIPPED due to mode: ${mode}`);
        }

        const settlements = await Promise.allSettled(promises);

        const hotels: UnifiedHotel[] = [];
        let rgCount = 0;
        let tjCount = 0;
        const errors: string[] = [];

        settlements.forEach((s) => {
            if (s.status === "fulfilled") {
                const { type, value } = s.value;
                hotels.push(...value);
                if (type === "RG") rgCount = value.length;
                if (type === "TJ") tjCount = value.length;
            } else {
                errors.push(s.reason);
            }
        });

        // Deduplicate all results to ensure consistency across providers
        const finalResults = deduplicateHotels(hotels);

        // Sort by price ascending
        finalResults.sort((a, b) => a.price - b.price);

        return {
            results: finalResults,
            meta: {
                rgCount,
                tjCount,
                errors
            }
        };
    }

    async getHotelSuggestions(query: string) {
        if (!query || query.length < 2) return [];

        const mode = process.env.HOTEL_PROVIDER_MODE || "UNIFIED";
        const promises = [];

        if (mode === "UNIFIED" || mode === "RG_ONLY") {
            promises.push(RGDestinationModel.find({
                destName: { $regex: query, $options: "i" }
            }).limit(5).lean());
        } else {
            promises.push(Promise.resolve([]));
        }

        if (mode === "UNIFIED" || mode === "TJ_ONLY") {
            promises.push(HotelModel.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { cityName: { $regex: query, $options: "i" } }
                ]
            }).limit(10).lean());
        } else {
            promises.push(Promise.resolve([]));
        }

        const [destinations, hotels] = await Promise.all(promises);

        const suggestions = [
            ...(destinations as any[]).map(d => ({
                id: d.destCode,
                name: d.destName,
                type: "city" as const,
                destCode: d.destCode
            })),
            ...(hotels as any[]).map(h => ({
                id: `TJ:${h.tjHotelId}`,
                name: h.name,
                type: "hotel" as const,
                city: h.cityName,
                country: h.countryName,
                hotelId: `TJ:${h.tjHotelId}`
            }))
        ];

        // Deduplicate suggestions by name to fix "multiple times same location" issue
        const uniqueSuggestions = Array.from(
            new Map(suggestions.map(item => [item.name.toLowerCase(), item])).values()
        );

        return uniqueSuggestions;
    }
}

export const hotelsService = new HotelsService();
