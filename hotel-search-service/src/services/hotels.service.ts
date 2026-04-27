import { searchRG } from "../adapters/rateGainAdapter";
import { searchTJ } from "../adapters/tripJackAdapter";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { HotelModel } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";
import { resolveCityToCoords } from "./destinationResolver";

class HotelsService {
    async searchHotels(searchPayload: UnifiedSearchRequest) {
        const mode = process.env.HOTEL_PROVIDER_MODE || "UNIFIED";
        console.log(`[DEBUG] searchHotels triggered. Mode: ${mode}`);
        const promises = [];

        if (mode === "UNIFIED" || mode === "RG_ONLY") {
            promises.push(searchRG(searchPayload).then(res => ({ type: "RG", value: res.hotels, total: res.total })));
        }
        if (mode === "UNIFIED" || mode === "TJ_ONLY") {
            const tjStart = Date.now();
            promises.push(searchTJ(searchPayload).then(res => {
                console.log(`[DEBUG] TJ Search finished in ${Date.now() - tjStart}ms, results: ${res.hotels.length}`);
                return { type: "TJ", value: res.hotels, total: res.total };
            }));
        } else {
            console.log(`[DEBUG] TJ Search SKIPPED due to mode: ${mode}`);
        }

        const settlements = await Promise.allSettled(promises);

        const hotels: UnifiedHotel[] = [];
        let rgCount = 0;
        let tjCount = 0;
        let rgTotal = 0;
        let tjTotal = 0;
        const errors: string[] = [];

        const geoCenter = await resolveCityToCoords(searchPayload.destination);

        settlements.forEach((s) => {
            if (s.status === "fulfilled") {
                let { type, value, total } = s.value;

                console.log(`[DEBUG] ${type} raw results: ${value.length} (Total available: ${total})`);

                // SAFETY FILTER: If we have a resolved geo-center, prune results far away (>100km)
                if (geoCenter) {
                    const originalCount = value.length;
                    value = value.filter(h => {
                        if (!h.latitude || !h.longitude) return true; // keep if no coords to avoid missing data
                        const dist = calculateDistance(geoCenter.lat, geoCenter.lng, h.latitude, h.longitude);
                        return dist <= 100; // 100km safety radius
                    });
                    if (value.length < originalCount) {
                        console.log(`[FILTER] Pruned ${originalCount - value.length} properties too far from resolved center of "${searchPayload.destination}" at [${geoCenter.lat}, ${geoCenter.lng}]`);
                    }
                }

                hotels.push(...value);
                if (type === "RG") {
                    rgCount = value.length;
                    rgTotal = total;
                }
                if (type === "TJ") {
                    tjCount = value.length;
                    tjTotal = total;
                }
            } else {
                console.error(`[DEBUG] Provider Error:`, s.reason);
                errors.push(s.reason);
            }
        });

        console.log(`[DEBUG] Array size before deduplication: ${hotels.length}`);
        // Deduplicate all results to ensure consistency across providers
        const finalResults = deduplicateHotels(hotels);
        console.log(`[DEBUG] Array size after deduplication: ${finalResults.length}`);

        // Sort by price ascending
        finalResults.sort((a, b) => a.price - b.price);

        // The total should be the maximum reported total from any provider (since it represents search breadth)
        // Or if we aggregate, we might need a better heuristic. 
        // For now, use the max of provided totals.
        const total = Math.max(rgTotal, tjTotal, finalResults.length);

        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 FINAL SEARCH SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TJ Results: ${tjCount} / Total: ${tjTotal}
RG Results: ${rgCount} / Total: ${rgTotal}
Combined & Deduplicated Items: ${finalResults.length}
Reported Total to UI: ${total}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

        return {
            results: finalResults,
            total,
            meta: {
                rgCount,
                tjCount,
                rgTotal,
                tjTotal,
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
            }).sort({ updatedAt: -1 }).limit(10).lean());
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

        const rawSuggestions = [
            ...(destinations as any[]).map(d => ({
                id: d.destCode?.toString(),
                name: d.destName,
                type: "city" as const,
                destCode: d.destCode?.toString()
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

        // Aggressive deduplication for suggestions
        const suggestions: any[] = [];
        const seenNames = new Set<string>();
        const seenIds = new Set<string>();

        for (const s of rawSuggestions) {
            const id = s.id?.toString().trim();
            // Normalize name: simple lowercase alphanumeric for comparison
            const normalizedName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');

            if (!id && s.type === 'city') continue;

            let isDuplicate = false;

            if (id && seenIds.has(id)) {
                isDuplicate = true;
            }

            if (!isDuplicate && seenNames.has(normalizedName)) {
                isDuplicate = true;
            }

            if (!isDuplicate && s.type === 'city') {
                for (const existing of suggestions) {
                    if (existing.type === 'city') {
                        const existingNormalized = existing.name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
                        if (normalizedName.includes(existingNormalized) || existingNormalized.includes(normalizedName)) {
                            isDuplicate = true;
                            break;
                        }
                    }
                }
            }

            if (!isDuplicate) {
                suggestions.push(s);
                seenNames.add(normalizedName);
                if (id) seenIds.add(id);
            }
        }

        return suggestions;
    }
}

export const hotelsService = new HotelsService();

/**
 * Haversine formula to calculate distance between two points in km.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
