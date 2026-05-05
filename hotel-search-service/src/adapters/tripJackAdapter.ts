import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForTJ } from "../services/destinationResolver";
import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";
import { HotelModel } from "../models/Hotel.model";

const ISO_TO_TJ_COUNTRY_ID: Record<string, string> = {
    IN: "106", US: "232", GB: "235", AE: "231", SG: "200", MY: "131",
    AU: "14", CA: "40", DE: "83", FR: "76", JP: "112", CN: "45", NZ: "157", ZA: "204",
};

function toTjNationality(isoCode: string): string {
    return ISO_TO_TJ_COUNTRY_ID[isoCode?.toUpperCase()] ?? "106";
}

// ─── TripJack Circuit Breaker ────────────────────────────────────────────────
let tjCircuitOpenUntil = 0;
function isTJCircuitOpen(): boolean {
    return Date.now() < tjCircuitOpenUntil;
}
function tripTJCircuit() {
    tjCircuitOpenUntil = Date.now() + 60_000;
    console.error(`[TripJack] ⚡ Circuit breaker OPEN.`);
}

export async function searchTJ(req: UnifiedSearchRequest): Promise<{ hotels: UnifiedHotel[]; total: number }> {
    if (isTJCircuitOpen()) return { hotels: [], total: 0 };

    const hids = await resolveForTJ(req.destination, req._geoCenter);
    if (!hids.length) return { hotels: [], total: 0 };

    const correlationId = uuidv4();
    const page = req.pageNo || 1;

    // REDUCED TARGET FOR SPEED: 100 hotels is more than enough for a single page view.
    // If we try for 300+, it will take 40+ seconds.
    const targetCount = page === 1 ? 100 : 50;

    const CHUNK_SIZE = 10; // Smaller chunks are less likely to timeout
    const chunks: string[][] = [];
    for (let i = 0; i < hids.length; i += CHUNK_SIZE) {
        chunks.push(hids.slice(i, i + CHUNK_SIZE));
    }

    let currentIdx = (page - 1) * 8; // Start at the current page's index

    try {
        let collectedHotels: any[] = [];
        console.log(`[TripJack] Fast Scavenging Page ${page}: Target ${targetCount} using chunks of ${CHUNK_SIZE}`);

        // Increase parallelism to 4 chunks at once (100 hotels in one batch!)
        // This should take ~10-15 seconds instead of 40.
        while (collectedHotels.length < targetCount && currentIdx < chunks.length) {
            const batchSize = 8; // More parallel requests
            const batch = chunks.slice(currentIdx, currentIdx + batchSize);

            const promises = batch.map(chunk => {
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
                return tripJackClient.post("/hms/v3/hotel/listing", payload, { timeout: 30000 }) // Higher timeout for slow sandbox
                    .then(res => ({ success: true, hotels: res.data.hotels || [] }))
                    .catch(err => {
                        console.error(`[TripJack] Chunk failed:`, err.message);
                        return { success: false };
                    });
            });

            const results = await Promise.all(promises);
            let anySuccess = false;
            for (const r of results) {
                if (r.success) {
                    collectedHotels.push(...(r as any).hotels);
                    anySuccess = true;
                }
            }

            if (!anySuccess && currentIdx > 0) break; // Stop if a whole batch fails
            currentIdx += batchSize;

            // If we have at least some hotels, return early to keep it "fast" for the user
            if (collectedHotels.length >= (targetCount / 2)) break;
        }

        const finalHotels = collectedHotels.slice(0, targetCount);
        console.log(`[TripJack] Fast Return: Returning ${finalHotels.length} hotels.`);

        let mapped: UnifiedHotel[] = finalHotels.map((h: any) => mapTJHotel(h, correlationId));

        // ASYNC ENRICHMENT (don't wait for DB if it's too slow, but here we do it fast)
        try {
            const tjIds = mapped.map(h => h.hotelId.replace("TJ:", ""));
            const staticData = await HotelModel.find({ tjHotelId: { $in: tjIds } }).limit(100).lean();
            const staticMap = new Map(staticData.map(s => [s.tjHotelId, s]));

            mapped = mapped.map(bh => {
                const s = staticMap.get(bh.hotelId.replace("TJ:", ""));
                if (s) {
                    return {
                        ...bh,
                        address: bh.address || s.address || "",
                        city: bh.city || s.cityName || "",
                        starRating: bh.starRating || s.starRating || 0,
                        images: (bh.images?.length) ? bh.images : (s.images || []),
                        latitude: bh.latitude || s.location?.coordinates?.[1],
                        longitude: bh.longitude || s.location?.coordinates?.[0],
                    };
                }
                return bh;
            });
        } catch (enrichErr) { }

        return {
            hotels: mapped,
            total: hids.length
        };
    } catch (error: any) {
        console.error("[TripJack Adapter] Search Error:", error.message);
        throw error;
    }
}

function mapTJHotel(h: any, correlationId: string): UnifiedHotel {
    const opt = h.options?.[0];
    const hotelId = h.tjHotelId || h.hotelId || h.id;
    return {
        hotelId: `TJ:${hotelId}`,
        source: "TJ",
        name: h.name,
        address: h.address,
        city: h.city,
        country: h.country,
        starRating: parseInt(h.rating) || 0,
        latitude: h.latitude,
        longitude: h.longitude,
        images: Array.isArray(h.images) ? h.images : (h.img ? [h.img] : []),
        price: opt?.pricing?.totalPrice ?? 0,
        currency: opt?.pricing?.currency ?? "INR",
        mealBasis: opt?.mealBasis,
        isRefundable: opt?.cancellation?.isRefundable,
        amenities: h.amenities || [],
        propertyCode: hotelId.toString(),
        brandCode: "",
        rawPayload: { ...h, _correlationId: correlationId },
    };
}
