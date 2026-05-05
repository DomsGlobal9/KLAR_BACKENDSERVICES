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
export async function resolveCityToCoords(query: string): Promise<{ lat: number, lng: number } | null> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check if query is already coordinates
    const coordRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
    const match = normalizedQuery.match(coordRegex);
    if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[3]) };
    }

    // Try to find a hotel in this city to get a representative point
    const hotel = await HotelModel.findOne({
        $or: [
            { cityName: { $regex: new RegExp(`^${normalizedQuery}$`, "i") } },
            { cityName: { $regex: new RegExp(normalizedQuery, "i") } }
        ]
    }).select("location").lean();

    if (hotel?.location?.coordinates) {
        const [lng, lat] = hotel.location.coordinates;
        console.log(`[GEO] Resolved city "${query}" to coordinates [${lat}, ${lng}] from DB`);
        return { lat, lng };
    }

    // fallback: External geocoding via Nominatim (Free, no key required for low volume)
    try {
        const axios = require('axios');
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
            headers: { 'User-Agent': 'Klar-Hotel-Search-Service' }
        });
        const data = response.data;
        if (data && data.length > 0) {
            const { lat, lon } = data[0];
            console.log(`[GEO] Resolved city "${query}" to coordinates [${lat}, ${lon}] via Nominatim`);
            return { lat: parseFloat(lat), lng: parseFloat(lon) };
        }
    } catch (e) {
        console.warn(`[GEO] Nominatim geocoding failed for "${query}":`, (e as any).message);
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
    
    const geo = preResolvedGeo !== undefined ? preResolvedGeo : await resolveCityToCoords(normalizedQuery);

    if (geo) {
        const { lat, lng } = geo;
        
        console.log(`[DEBUG] resolveForTJ: Using coordinates [${lat}, ${lng}] for search.`);
        
        // Find hotels within 50km radius, sorted by distance
        const hotels = await HotelModel.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat] // MongoDB uses [lng, lat]
                    },
                    $maxDistance: 50000 // 50km
                }
            }
        })
        .select("tjHotelId")
        .lean();

        return [...new Set(hotels.map((h) => h.tjHotelId))];
    }

    // 2. City/Hotel Name Search (Fallback if no Geo available)
    console.log(`[DEBUG] resolveForTJ: Performing hierarchical fuzzy search for "${normalizedQuery}"`);
    
    // Step A: Attempt Text Search (True Fuzzy-like matching via MongoDB index)
    let hotels = await HotelModel.find({
        $text: { $search: normalizedQuery }
    })
    .select("tjHotelId")
    .lean();

    console.log(`[DEBUG] resolveForTJ: Text search found ${hotels.length} hotels.`);

    // Step B: Fallback to Phrase Regex (if text search fails or too few results)
    if (hotels.length < 5) {
        const regexHotels = await HotelModel.find({
            cityName: { $regex: new RegExp(normalizedQuery, "i") }
        }).select("tjHotelId").lean();
        
        if (regexHotels.length > hotels.length) {
            hotels = regexHotels;
            console.log(`[DEBUG] resolveForTJ: Regex fallback improved count to ${hotels.length}`);
        }
    }

    // Step C: Fallback for very short or no-match queries (AND-based search across Name, City)
    if (hotels.length === 0) {
        const words = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            const andConditions = words.map(word => ({
                $or: [
                    { cityName: { $regex: new RegExp(word, "i") } },
                    { name: { $regex: new RegExp(word, "i") } }
                ]
            }));
            hotels = await HotelModel.find({ $and: andConditions })
                .select("tjHotelId")
                .lean();
        }
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
