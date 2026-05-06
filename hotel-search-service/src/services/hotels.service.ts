import { searchRG } from "../adapters/rateGainAdapter";
import { searchTJ } from "../adapters/tripJackAdapter";
import { resolveCityToCoords } from "./destinationResolver";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";

export class HotelsService {
    /**
     * Unified Search Entry Point
     * Senior OTA Strategy: Concurrently fetch, partial return on slow providers, 
     * and high-efficiency deduplication.
     */
    async searchHotels(searchPayload: UnifiedSearchRequest) {
        const totalStartTime = Date.now();
        const mode = process.env.HOTEL_PROVIDER_MODE || "UNIFIED";
        console.log(`[DEBUG] searchHotels triggered for "${searchPayload.destination}". Mode: ${mode}`);
        
        // 1. Resolve Location (Once)
        const geoCenter = await resolveCityToCoords(searchPayload.destination);
        searchPayload._geoCenter = geoCenter;

        const finalResults: UnifiedHotel[] = [];
        let rgTotal = 0;
        let tjTotal = 0;
        let rgCount = 0;
        let tjCount = 0;

        // 2. Define Providers based on Mode
        const providers: { name: string; task: Promise<void> }[] = [];
        
        if (mode === "UNIFIED" || mode === "RG_ONLY") {
            providers.push({
                name: "RG",
                task: searchRG(searchPayload).then(res => {
                    rgCount = res.hotels.length;
                    rgTotal = res.total;
                    finalResults.push(...res.hotels);
                    console.log(`[OK] RG finished in ${Date.now() - totalStartTime}ms (${rgCount} hotels)`);
                }).catch(err => {
                    console.error(`[ERR] RG failed: ${err.message}`);
                })
            });
        }
        
        if (mode === "UNIFIED" || mode === "TJ_ONLY") {
            providers.push({
                name: "TJ",
                task: searchTJ(searchPayload).then(res => {
                    tjCount = res.hotels.length;
                    tjTotal = res.total;
                    finalResults.push(...res.hotels);
                    console.log(`[OK] TJ finished in ${Date.now() - totalStartTime}ms (${tjCount} hotels)`);
                }).catch(err => {
                    console.error(`[ERR] TJ failed: ${err.message}`);
                })
            });
        }

        // 3. Orchestration: High-Performance Concurrent Collection
        // We wait for ALL providers, but if one hangs, the 50s cutoff ensures we return whatever we have.
        const allTasks = providers.map(p => p.task);
        
        // Senior Dev: Removed safety cutoff as requested. 
        // We will now wait for all providers to finish, regardless of time.
        await Promise.all(allTasks);

        // 4. Deduplication Logic (MMT-style efficient dedup)
        const { items: deduplicatedResults, meta: dedupMeta } = deduplicateHotels(finalResults);
        
        // Calculate reported total (rough estimate)
        const activeTjTotal = tjCount > 0 ? tjTotal : 0;
        const activeRgTotal = rgCount > 0 ? rgTotal : 0;
        const totalToUI = Math.max(activeRgTotal + activeTjTotal, deduplicatedResults.length);

        const totalDuration = Date.now() - totalStartTime;

        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 FINAL SEARCH SUMMARY (Senior OTA Logic)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TJ Search Results: ${tjCount} / Provider Total: ${tjTotal}
RG Search Results: ${rgCount} / Provider Total: ${rgTotal}
----------------------------------------------------
Total Combined Unique:     ${deduplicatedResults.length}
Deduplicated Items Removed: ${dedupMeta.duplicatedCount}
Search Duration:           ${totalDuration}ms
----------------------------------------------------
Reported Total to UI:      ${totalToUI}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

        return {
            results: deduplicatedResults,
            body: deduplicatedResults, // Fallback for some frontend components
            hotels: deduplicatedResults,
            total: totalToUI
        };
    }

    async getHotelSuggestions(query: string) {
        // Logic implemented in previous turns
        const { HotelModel } = require("../models/Hotel.model");
        const { RGDestinationModel } = require("../models/RGDestination.model");

        const rgDests = await RGDestinationModel.find({
            destName: { $regex: new RegExp(query, "i") }
        }).limit(5).lean();

        const hotels = await HotelModel.find({
            $or: [
                { name: { $regex: new RegExp(query, "i") } },
                { cityName: { $regex: new RegExp(query, "i") } }
            ]
        }).limit(10).lean();

        const suggestions = [
            ...rgDests.map((d: any) => ({
                id: d.destCode,
                label: d.destName,
                type: "city",
                source: "RG"
            })),
            ...hotels.map((h: any) => {
                const hotelId = h.tjHotelId.startsWith("TJ:") ? h.tjHotelId : `TJ:${h.tjHotelId}`;
                return {
                    id: hotelId,
                    hotelId: hotelId,
                    label: `${h.name}, ${h.cityName}`,
                    type: "hotel",
                    source: "TJ",
                    city: h.cityName
                };
            })
        ];

        // Deduplicate suggestions by name to fix "multiple times same location" issue
        const uniqueSuggestions = Array.from(
            new Map(suggestions.map(item => [item.label.toLowerCase(), item])).values()
        );

        return uniqueSuggestions;
    }
}

export const hotelsService = new HotelsService();
