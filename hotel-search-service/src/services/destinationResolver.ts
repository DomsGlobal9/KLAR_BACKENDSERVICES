/**
 * Destination Resolver — queries MongoDB instead of in-memory Maps.
 */
import { HotelModel, IHotelData } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";

/**
 * Resolve a city query to a RateGain destination code.
 */
/**
 * Attempt to find coordinates for a given city query using the existing hotel database.
 * This helps "geo-tag" a search even when the user just types a name.
 */
export async function resolveCityToCoords(query: string): Promise<{ lat: number; lng: number } | null> {
    if (!query || query.length < 2) return null;
    const normalizedQuery = query.toLowerCase().trim();

    // Strategy 1: Look for an exact city name match in our database (Fastest)
    // We strictly use anchors ^...$ to avoid "Goa" matching "Goettingen"
    const hotel = await HotelModel.findOne({
        cityName: { $regex: new RegExp(`^${normalizedQuery}$`, "i") }
    }).select("location").lean();

    if (hotel?.location?.coordinates) {
        const [lng, lat] = hotel.location.coordinates;
        console.log(`[GEO] Resolved city "${query}" to coordinates [${lat}, ${lng}] from DB (Exact Match)`);
        return { lat, lng };
    }

    // Sub-strategy: If query is multi-word (e.g. "Goa, India"), try matching the first part
    const parts = normalizedQuery.split(/[\s,]+/);
    if (parts.length > 1) {
        const firstPart = parts[0];
        const partialHotel = await HotelModel.findOne({
            cityName: { $regex: new RegExp(`^${firstPart}$`, "i") }
        }).select("location").lean();

        if (partialHotel?.location?.coordinates) {
            const [lng, lat] = partialHotel.location.coordinates;
            console.log(`[GEO] Resolved part "${firstPart}" from "${query}" to [${lat}, ${lng}] from DB`);
            return { lat, lng };
        }
    }

    // Strategy 2: External geocoding via Nominatim (Reliable global fallback)
    try {
        console.log(`[GEO] No exact DB match for "${query}". Fetching from Nominatim...`);
        const axios = require('axios');
        // We append "country=IN" or similar if we detect India-specific intent to aid resolution
        const q = normalizedQuery.includes("india") ? normalizedQuery : `${normalizedQuery}, India`;
        
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
            headers: { 'User-Agent': 'Klar-Hotel-Search-Service/1.0' },
            timeout: 5000
        });

        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            console.log(`[GEO] Nominatim resolved "${query}" to [${lat}, ${lng}] (${result.display_name})`);
            return { lat, lng };
        }
    } catch (error: any) {
        console.error(`[GEO] Nominatim error for "${query}":`, error.message);
    }

    return null;
}

/**
 * Resolve a city query to a RateGain destination code.
 */
export async function resolveForRG(query: string): Promise<string | null> {
    const normalizedQuery = query.toLowerCase().trim();

    // 0. If it's already a numeric code, return it directly
    if (/^\d+$/.test(normalizedQuery)) {
        return normalizedQuery;
    }

    const words = normalizedQuery.split(/\s+/);

    // 1. Try exact or regex match (handles "dubai" -> "dubai united arab emirates")
    // Use sort by updatedAt desc to get the most fresh codes if duplicates exist
    let dest = await RGDestinationModel.findOne({
        $or: [
            { destName: normalizedQuery },
            { destName: { $regex: new RegExp(`^${normalizedQuery}`, "i") } }
        ]
    }).sort({ updatedAt: -1 });

    // 2. Fuzzy Text Search Fallback
    if (!dest) {
        // IMPROVEMENT: Use phrase match or limit text search to prevent broad matches like "China" for "Shangqiu China"
        const results = await RGDestinationModel.find({
            $text: { $search: normalizedQuery }
        }).sort({ score: { $meta: "textScore" }, updatedAt: -1 }).limit(3);

        if (results.length > 0) {
            // Only accept if the name is reasonably similar to the query
            // If query is "shangqiu china" and we match "china", it's suspicious if shangqiu is not in the name
            const firstResult = results[0]!;
            const resNameLower = firstResult.destName.toLowerCase();
            const queryWords = normalizedQuery.split(/\s+/);

            // If the query has multiple words, the first word should ideally be in the result name
            if (queryWords.length > 1 && !resNameLower.includes(queryWords[0]!)) {
                console.log(`[DEBUG] resolveForRG: Rejected text match "${firstResult.destName}" for query "${query}" (missing first word "${queryWords[0]}")`);
            } else {
                dest = firstResult;
            }
        }
    }

    // 3. First Word Fallback - Only as a last resort and if it's not a generic word
    const GENERIC_WORDS = ['india', 'china', 'usa', 'united', 'states', 'kingdom', 'arab', 'emirates'];
    if (!dest && words.length > 0 && !GENERIC_WORDS.includes(words[0]!)) {
        dest = await RGDestinationModel.findOne({
            destName: { $regex: new RegExp(`^${words[0]}`, "i") }
        }).sort({ updatedAt: -1 });
    }

    const result = dest?.destCode || null;
    console.log(`[DEBUG] resolveForRG: Resolved "${query}" (normalized: "${normalizedQuery}") to ${result} (Name: ${dest?.destName})`);
    return result;
}

/**
 * Resolve a city query to an array of TripJack hotel IDs.
 */
export async function resolveForTJ(query: string, preResolvedGeo?: { lat: number; lng: number } | null): Promise<string[]> {
    const normalizedQuery = query.trim();
    const isIndianQuery = normalizedQuery.toLowerCase().includes("india") || normalizedQuery.toLowerCase().includes("goa");

    const geo = preResolvedGeo !== undefined ? preResolvedGeo : await resolveCityToCoords(normalizedQuery);

    if (geo) {
        const { lat, lng } = geo;
        console.log(`[DEBUG] resolveForTJ: Searching near [${lat}, ${lng}] for "${normalizedQuery}"`);

        // Find hotels within 50km radius
        let hotels = await HotelModel.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    $maxDistance: 50000 // 50km
                }
            }
        })
            .select("tjHotelId countryName")
            .lean();

        // Sanity Check: If searching for India but resolved to Germany (or vice versa), filter out
        if (isIndianQuery) {
            hotels = hotels.filter(h => 
                !h.countryName || 
                h.countryName.toLowerCase().includes("india") || 
                !h.countryName.toLowerCase().includes("germany")
            );
        }

        return [...new Set(hotels.map((h) => h.tjHotelId))];
    }

    // 2. City/Hotel Name Search (Fallback if no Geo available)
    console.log(`[DEBUG] resolveForTJ: Performing hierarchical fuzzy search for "${normalizedQuery}"`);

    // Step A: Attempt Text Search
    let hotels = await HotelModel.find({
        $text: { $search: normalizedQuery }
    })
        .select("tjHotelId countryName")
        .lean();

    // Step B: Fallback to Phrase Regex
    if (hotels.length < 5) {
        const regexHotels = await HotelModel.find({
            cityName: { $regex: new RegExp(`^${normalizedQuery}$`, "i") }
        }).select("tjHotelId countryName").lean();

        if (regexHotels.length > hotels.length) {
            hotels = regexHotels;
        }
    }

    // Geographic filtering for text/regex results too
    if (isIndianQuery) {
        hotels = hotels.filter(h => 
            !h.countryName || 
            h.countryName.toLowerCase().includes("india") || 
            !h.countryName.toLowerCase().includes("germany")
        );
    }

    const uniqueHids = [...new Set(hotels.map((h: any) => h.tjHotelId).filter(Boolean))];
    console.log(`[DEBUG] resolveForTJ: Resolved "${normalizedQuery}" to ${uniqueHids.length} hotels`);

    return uniqueHids;
}


/**
 * Get static hotel data for a TripJack hotel ID (for enrichment).
 */
export async function getHotelStaticData(
    tjHotelId: string
): Promise<IHotelData | null> {
    return HotelModel.findOne({ tjHotelId }).lean() as Promise<IHotelData | null>;
}

/**
 * Batch get static data for multiple TJ hotel IDs (more efficient).
 */
export async function getHotelStaticDataBatch(
    tjHotelIds: string[]
): Promise<Map<string, IHotelData>> {
    const hotels = await HotelModel.find({
        tjHotelId: { $in: tjHotelIds },
    }).lean();

    const map = new Map<string, IHotelData>();
    for (const h of hotels) {
        map.set(h.tjHotelId, h as IHotelData);
    }
    return map;
}
