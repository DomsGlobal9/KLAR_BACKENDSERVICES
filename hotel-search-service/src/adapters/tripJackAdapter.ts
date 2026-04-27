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

export async function searchTJ(req: UnifiedSearchRequest): Promise<{ hotels: UnifiedHotel[]; total: number }> {
    const hids = await resolveForTJ(req.destination);
    if (!hids.length) return [];

    const correlationId = uuidv4();

    // 3. Chunk HIDs into groups of 100 (TripJack limit)
    const chunks: string[][] = [];
    for (let i = 0; i < hids.length; i += 100) {
        chunks.push(hids.slice(i, i + 100));
    }

    try {
        const searchPromises = chunks.map(async (chunk, index) => {
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
            
            const res = await tripJackClient.post("/hms/v3/hotel/listing", payload);
            return res.data.hotels || [];
        });

        const results = await Promise.all(searchPromises);
        const allHotels = results.flat();
        
        console.log(`
┌─────────── TRIPJACK SEARCH STATS ───────────┐
│ 📍 Location: ${req.destination}
│ 🔍 Total HIDs in DB: ${hids.length}
│ 🚀 Hitting API with: ${hids.length} hotels
│ ✅ API returned: ${allHotels.length} hotels
└─────────────────────────────────────────────┘
        `);

        let mapped: UnifiedHotel[] = allHotels.map((h: any) =>
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
            total: mapped.length // TJ search returns all matching hotels for the provided HIDs
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
