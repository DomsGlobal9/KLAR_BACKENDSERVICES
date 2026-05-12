import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForTJ } from "../services/destinationResolver";
import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";
import { HotelModel } from "../models/Hotel.model";

import { NationalityModel } from "../models/Nationality.model";

const ISO_TO_TJ_COUNTRY_ID: Record<string, string> = {
    IN: "106", US: "232", GB: "235", AE: "231", SG: "200", MY: "131",
    AU: "14", CA: "40", DE: "83", FR: "76", JP: "112", CN: "45", NZ: "157", ZA: "204",
};

async function toTjNationality(isoCode: string): Promise<string> {
    try {
        if (!isoCode) return "106";
        const code = isoCode.toUpperCase();
        const found = await NationalityModel.findOne({ code }).select("countryId").lean();
        if (found) return found.countryId;
    } catch (err) {
        console.warn("[TripJack Search] Nationality DB lookup failed, using fallback.");
    }
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

    // REDUCED TARGET FOR SPEED: 50 hotels is more than enough for a single page view.
    // Fetching 50 hotels takes ~3-5 seconds.
    const targetCount = 50;

    const CHUNK_SIZE = 10; // Safer for Sandbox
    const chunks: string[][] = [];
    for (let i = 0; i < hids.length; i += CHUNK_SIZE) {
        chunks.push(hids.slice(i, i + CHUNK_SIZE));
    }

    const batchSize = 5; // Fetch 5 chunks (50 IDs) per page
    let currentIdx = (page - 1) * batchSize;

    try {
        let collectedHotels: any[] = [];
        const startId = currentIdx * CHUNK_SIZE;
        const endId = Math.min(startId + (batchSize * CHUNK_SIZE), hids.length);
        console.log(`[TripJack] Pagination: Page ${page} processing HIDs index ${startId} to ${endId}`);

        const nationalityId = await toTjNationality(req.countryCode ?? "IN");
        const fetchStartTime = Date.now();

        // Fetch chunks sequentially to avoid 403 and ensure high yield
        for (let i = 0; i < batchSize; i++) {
            const chunkIdx = currentIdx + i;
            if (chunkIdx >= chunks.length) break;

            const chunk = chunks[chunkIdx];
            try {
                const payload = {
                    checkIn: req.checkin,
                    checkOut: req.checkout,
                    rooms: req.rooms.map((r) => ({
                        adults: r.adults,
                        children: r.children || undefined,
                        childAge: r.childAges?.length ? r.childAges : undefined,
                    })),
                    currency: req.currency ?? "INR",
                    nationality: nationalityId,
                    hids: chunk.map(id => parseInt(id)),
                    correlationId,
                };

                const res = await tripJackClient.post("/hms/v3/hotel/listing", payload, { timeout: 30000 });
                const found = res.data.hotels || [];
                collectedHotels.push(...found);
            } catch (err: any) {
                console.error(`[TripJack] Chunk Fetch Error:`, err.message);
            }
        }

        collectedHotels = collectedHotels.slice(0, targetCount);
        console.log(`[TripJack] Parallel Fetch Complete in ${Date.now() - fetchStartTime}ms. Found ${collectedHotels.length} hotels.`);

        const finalHotels = collectedHotels.slice(0, targetCount);
        console.log(`[TripJack] Fast Return: Returning ${finalHotels.length} hotels.`);

        let mapped: UnifiedHotel[] = finalHotels.map((h: any) => mapTJHotel(h, correlationId));

        // Geographic Sanity Check: Ensure results match the intended region
        const isIndiaTarget = req.destination.toLowerCase().includes("india") || req.destination.toLowerCase().includes("goa") || (req.countryCode === "IN");
        if (isIndiaTarget) {
            const initialCount = mapped.length;
            mapped = mapped.filter(h => {
                const addr = (h.address || "").toLowerCase();
                const country = (h.country || "").toLowerCase();
                // Filter out German hotels if we are targeting India
                if (addr.includes("germany") || country.includes("germany") || country.includes("deutschland")) {
                    return false;
                }
                return true;
            });
            if (mapped.length < initialCount) {
                console.log(`[TripJack] Filtered out ${initialCount - mapped.length} cross-region hotels (Germany -> India).`);
            }
        }

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
        onHoldAllowed: opt?.onHoldAllowed ?? opt?.cancellation?.onHoldAllowed ?? (opt?.cancellation?.isRefundable ?? false),
        holdConfirm: opt?.holdConfirm ?? opt?.cancellation?.holdConfirm ?? (opt?.cancellation?.isRefundable ?? false),
        amenities: h.amenities || [],
        propertyCode: hotelId.toString(),
        brandCode: "",
        rawPayload: { ...h, _correlationId: correlationId },
    };
}
