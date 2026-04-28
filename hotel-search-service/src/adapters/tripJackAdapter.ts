import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForTJ } from "../services/destinationResolver";
import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";

/**
 * TripJack requires its own internal countryId (e.g. "106" for India),
 * NOT the ISO 2-letter code.
 * Source: GET /hms/v3/nationality-info → nationalityInfos[].countryId
 * Extend this map as needed or replace with a DB lookup.
 */
const ISO_TO_TJ_COUNTRY_ID: Record<string, string> = {
    IN: "106",
    US: "232",
    GB: "235",
    AE: "231",
    SG: "200",
    MY: "131",
    AU: "14",
    CA: "40",
    DE: "83",
    FR: "76",
    JP: "112",
    CN: "45",
    NZ: "157",
    ZA: "204",
};

function toTjNationality(isoCode: string): string {
    return ISO_TO_TJ_COUNTRY_ID[isoCode?.toUpperCase()] ?? "106"; // fallback: India
}

import { HotelModel } from "../models/Hotel.model";

// ─── Circuit Breaker ────────────────────────────────────────────────────────
// If TripJack's servers fail, we mark the circuit OPEN for 60s.
// This prevents hanging the entire search for minutes on dead server retries.
let circuitOpenUntil = 0; // unix timestamp in ms

function isTJCircuitOpen(): boolean {
    if (Date.now() < circuitOpenUntil) {
        console.warn(`[TripJack] ⚡ Circuit breaker OPEN. Skipping TJ until ${new Date(circuitOpenUntil).toISOString()}`);
        return true;
    }
    return false;
}

function tripTJCircuit() {
    circuitOpenUntil = Date.now() + 60_000; // block for 60s
    console.error(`[TripJack] ⚡ Circuit tripped. Blocking TJ requests for 60 seconds.`);
}

export async function searchTJ(req: UnifiedSearchRequest): Promise<{ hotels: UnifiedHotel[]; total: number }> {
    // 1. Fast circuit breaker check — skip immediately if TJ is known bad
    if (isTJCircuitOpen()) {
        return { hotels: [], total: 0 };
    }

    const hids = await resolveForTJ(req.destination);
    if (!hids.length) return { hotels: [], total: 0 };

    const correlationId = uuidv4();

    // 3. Chunk HIDs into smaller groups. 
    // TripJack limit is 100, but requests with 40 are still timing out.
    // Using 10 items per chunk guarantees a very fast response from their sandbox.
    const chunks: string[][] = [];
    for (let i = 0; i < hids.length; i += 10) {
        chunks.push(hids.slice(i, i + 10));
    }

    try {
        const page = req.pageNo || 1;
        // 30 for initial load, 20 for scrolling
        const targetCount = page === 1 ? 30 : 20; 
        let collectedHotels: any[] = [];
        
        // If chunk size is 10, page 1 uses ~3 chunks. Page 2 uses ~2 chunks.
        let currentIdx = page === 1 ? 0 : 3 + ((page - 2) * 2); 

        console.log(`[TripJack Adapter] Page ${page}: Target ${targetCount} hotels...`);

        // 2. Health Probe — fire a quick single-HID test request before committing to full search
        const probeChunk = chunks[currentIdx]?.slice(0, 1);
        if (probeChunk && probeChunk.length > 0) {
            try {
                console.log(`[TripJack] 🔍 Health probe...`);
                await tripJackClient.post("/hms/v3/hotel/listing", {
                    checkIn: req.checkin,
                    checkOut: req.checkout,
                    rooms: req.rooms.map((r) => ({ adults: r.adults })),
                    currency: req.currency ?? "INR",
                    nationality: toTjNationality(req.countryCode ?? "IN"),
                    hids: probeChunk,
                    correlationId,
                }, { timeout: 5000 });
                console.log(`[TripJack] ✅ Health probe passed. Starting full search.`);
            } catch (probeErr: any) {
                console.error(`[TripJack] ❌ Health probe failed:`, probeErr.response?.data?.title || probeErr.message);
                tripTJCircuit(); 
                return { hotels: [], total: 0 }; 
            }
        } // ...

        let consecutiveFailures = 0;

        while (collectedHotels.length < targetCount && currentIdx < chunks.length) {
            const chunk = chunks[currentIdx];
            console.log(`[TripJack Adapter] Scavenging chunk ${currentIdx} (Sequential)...`);

            if (!chunk || !chunk.length) {
                currentIdx++;
                continue;
            }

            const payload = {
                checkIn: req.checkin,
                checkOut: req.checkout,
                rooms: req.rooms.map((r) => ({
                    adults: r.adults,
                    children: r.children || undefined,
                    childAge: r.childAges?.length ? r.childAges : undefined,
                })),
                currency: req.currency ?? "INR",
                nationality: toTjNationality(req.countryCode ?? "IN"),
                hids: chunk,
                correlationId,
            };
            
            try {
                // Giving it 25 seconds because the user wants data regardless of latency.
                const res = await tripJackClient.post("/hms/v3/hotel/listing", payload, { timeout: 25000 });
                const foundInBatch = res.data.hotels || [];
                collectedHotels = [...collectedHotels, ...foundInBatch];
                consecutiveFailures = 0; // reset on success

                if (foundInBatch.length === 0 && collectedHotels.length === 0 && currentIdx > 10) {
                    break;
                }
            } catch (err: any) {
                consecutiveFailures++;
                console.error(`[TripJack] Chunk ${currentIdx} failed:`, err.response?.data?.title || err.message);
                
                if (consecutiveFailures >= 2) {
                    console.warn(`[TripJack] 2 consecutive failures mid-search. Bailing on this specific page to keep things moving, but keeping circuit OPEN so pagination works!`);
                    break;
                }
            }

            currentIdx++;
        }

        // Limit to target
        const finalHotels = collectedHotels.slice(0, targetCount);
        
        console.log(`[TripJack Adapter] Scavenging complete. Found: ${finalHotels.length} hotels`);

        // Report an accurate total:
        // - If we found nothing (server down), report 0 so UI doesn't show fake pagination
        // - If we found hotels, report hids.length as the theoretical max available
        const reportedTotal = finalHotels.length === 0 ? 0 : hids.length;

        let mapped: UnifiedHotel[] = finalHotels.map((h: any) =>
            mapTJHotel(h, correlationId)
        );

        // ENRICH WITH STATIC DATA FROM DB (if available)
        try {
            const tjHotelIds = mapped.map(h => h.hotelId.replace("TJ:", ""));
            const staticHotels = await HotelModel.find({ tjHotelId: { $in: tjHotelIds } }).lean();
            const staticMap = new Map(staticHotels.map(sh => [sh.tjHotelId, sh]));

            mapped = mapped.map(bh => {
                const rawId = bh.hotelId.replace("TJ:", "");
                const sh = staticMap.get(rawId);
                if (sh) {
                    return {
                        ...bh,
                        address: bh.address || sh.address || "",
                        city: bh.city || sh.cityName || "",
                        starRating: bh.starRating || sh.starRating || 0,
                        images: (bh.images && bh.images.length > 0) ? bh.images : (sh.images || []),
                        latitude: bh.latitude || (sh.location?.coordinates?.[1]),
                        longitude: bh.longitude || (sh.location?.coordinates?.[0]),
                    };
                }
                return bh;
            });
        } catch (dbError) {
            console.warn("[TripJack Adapter] DB Enrichment Failed:", dbError);
        }

        return {
            hotels: mapped,
            total: reportedTotal
        };
    } catch (error: any) {
        console.error("[TripJack Adapter] Search Error:", error.response?.data || error.message);
        throw error;
    }
}

function mapTJHotel(h: any, correlationId: string): UnifiedHotel {
    const opt = h.options?.[0];

    const liveImages = Array.isArray(h.images)
        ? h.images
        : (h.img ? [h.img] : []);

    const hotelId = h.tjHotelId || h.hotelId || h.id;

    return {
        hotelId: `TJ:${hotelId}`,
        source: "TJ",
        name: h.name,
        address: h.address,
        city: h.city,
        country: h.country,
        starRating: parseInt(h.rating),
        latitude: h.latitude,
        longitude: h.longitude,
        images: liveImages,
        price: opt?.pricing?.totalPrice ?? 0,
        currency: opt?.pricing?.currency ?? "INR",
        mealBasis: opt?.mealBasis,
        isRefundable: opt?.cancellation?.isRefundable,
        amenities: h.amenities || [],
        propertyCode: hotelId.toString(),
        brandCode: "",
        rawPayload: {
            ...h,
            // Pass correlationId along so Detail page can use the same one
            _correlationId: correlationId,
        },
    };
}
