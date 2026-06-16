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

        const isDirectTJ = searchPayload.destination.startsWith('TJ:') || /^\d{8,15}$/.test(searchPayload.destination.trim());
        const isDirectRG = searchPayload.destination.startsWith('RG:');
        const isDirectSearch = isDirectTJ || isDirectRG;

        if (isDirectSearch) {
            console.log(`[DEBUG] Direct hotel search detected for "${searchPayload.destination}".`);
        }

        // 1. Resolve Location (Once) - Skip if direct search
        const geoCenter = isDirectSearch ? null : await resolveCityToCoords(searchPayload.destination);
        searchPayload._geoCenter = geoCenter;

        const finalResults: UnifiedHotel[] = [];
        let rgTotal = 0;
        let tjTotal = 0;
        let rgCount = 0;
        let tjCount = 0;

        // 2. Define Providers based on Mode
        const providers: { name: string; task: Promise<void> }[] = [];

        if ((mode === "UNIFIED" || mode === "RG_ONLY") && (!isDirectSearch || isDirectRG)) {
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

        if ((mode === "UNIFIED" || mode === "TJ_ONLY") && (!isDirectSearch || isDirectTJ)) {
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
        // Wait for all providers, but cap at 8 seconds for partial-result return (MMT-style).
        // If a provider hasn't responded in 8s we return what we have rather than blocking UI.
        const allTasks = providers.map(p => p.task);
        const PARTIAL_RETURN_TIMEOUT_MS = 8000;

        await Promise.race([
            Promise.allSettled(allTasks),
            new Promise<void>(resolve => setTimeout(resolve, PARTIAL_RETURN_TIMEOUT_MS))
        ]);

        // If any provider is still pending after timeout, we return whatever arrived.
        // (The pending promises continue in background but we don't await them further.)


        // 4. Deduplication Logic (MMT-style efficient dedup)
        const totalReceivedCount = finalResults.length;
        const { items: deduplicatedResults, meta: dedupMeta } = deduplicateHotels(finalResults);

        // Calculate reported total (rough estimate)
        // Senior Dev: If we are on Page 1 and have fewer than 10 results but provider says more, 
        // we should still respect the provider's total for pagination to work, 
        // but only if the provider actually returned something.
        const totalToUI = Math.max(rgTotal + tjTotal, deduplicatedResults.length);

        const totalDuration = Date.now() - totalStartTime;

        const tjLog = ((mode === "UNIFIED" || mode === "TJ_ONLY") && (!isDirectSearch || isDirectTJ)) ? `${tjCount} (Total: ${tjTotal})` : "[SKIPPED]";
        const rgLog = ((mode === "UNIFIED" || mode === "RG_ONLY") && (!isDirectSearch || isDirectRG)) ? `${rgCount} (Total: ${rgTotal})` : "[SKIPPED]";

        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 FINAL SEARCH SUMMARY (Senior OTA Logic)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TJ Status: ${tjLog}
RG Status: ${rgLog}
----------------------------------------------------
Total Combined Unique:     ${deduplicatedResults.length}
Items Merged (Cheaper Wins): ${dedupMeta.duplicatedCount}
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

        // Execute both queries concurrently for maximum speed
        const [rgDests, hotels] = await Promise.all([
            // Use $text index for blazing fast destination searches
            RGDestinationModel.find(
                { $text: { $search: query } },
                { score: { $meta: "textScore" } }
            )
            .sort({ score: { $meta: "textScore" } })
            .limit(5)
            .lean(),
            
            // Use $text index for blazing fast name/city searches
            HotelModel.find(
                { $text: { $search: query } },
                { score: { $meta: "textScore" } }
            )
            .sort({ score: { $meta: "textScore" } })
            .limit(15)
            .lean()
        ]);

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
            new Map(suggestions.map(item => {
                const dedupeKey = item.type === "city" 
                    ? item.label.split(',')[0].toLowerCase().trim() 
                    : item.label.toLowerCase().trim();
                return [dedupeKey, item];
            })).values()
        );

        return uniqueSuggestions;
    }
}

export const hotelsService = new HotelsService();
