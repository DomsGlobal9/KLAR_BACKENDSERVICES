/**
 * Destination Resolver — queries MongoDB instead of in-memory Maps.
 */
import { HotelModel, IHotelData } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";

const GENERIC_WORDS = ['india', 'china', 'usa', 'united', 'states', 'kingdom', 'arab', 'emirates', 'san', 'city', 'by', 'the', 'house', 'hotel', 'resort'];

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

    const capitalizeWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    const tryFindCity = async (cityName: string) => {
        const capitalized = capitalizeWord(cityName);
        // 1. Try capitalized exact match (uses index, <1ms)
        let found = await HotelModel.findOne({ cityName: capitalized }).select("location").lean();
        if (!found) {
            // 2. Try exact casing matches (uses index, <1ms)
            found = await HotelModel.findOne({ 
                cityName: { $in: [cityName.toLowerCase(), cityName.toUpperCase(), cityName] } 
            }).select("location").lean();
        }
        if (!found) {
            // 3. Fallback to case-insensitive regex (slow but robust)
            found = await HotelModel.findOne({
                cityName: { $regex: `^${cityName}$`, $options: "i" }
            }).select("location").lean();
        }
        return found;
    };

    // Strategy 1: Look for an exact city name match in our database (Fastest)
    const hotel = await tryFindCity(normalizedQuery);

    if (hotel?.location?.coordinates) {
        const [lng, lat] = hotel.location.coordinates;
        console.log(`[GEO] Resolved city "${query}" to coordinates [${lat}, ${lng}] from DB (Exact Match)`);
        return { lat, lng };
    }

    // Sub-strategy: If query is multi-word (e.g. "Goa, India"), try matching the first part
    const parts = normalizedQuery.split(/[\s,]+/);
    if (parts.length > 1) {
        const firstPart = parts[0];
        const partialHotel = await tryFindCity(firstPart);

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
        
        // Step 1: Try the exact query as provided
        let response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery)}&limit=1`, {
            headers: { 'User-Agent': 'Klar-Hotel-Search-Service/1.0' },
            timeout: 5000
        });

        // Step 2: If no result, and it doesn't look like it has a country, try appending India
        if ((!response.data || response.data.length === 0) && !normalizedQuery.includes(",")) {
             console.log(`[GEO] No results for "${normalizedQuery}", retrying with India suffix...`);
             response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery + ", India")}&limit=1`, {
                headers: { 'User-Agent': 'Klar-Hotel-Search-Service/1.0' },
                timeout: 5000
            });
        }

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
function rateGainCodePriority(code: string): number {
    const trimmed = (code || "").trim();
    // GIATA code: exactly 6 alphanumeric characters containing at least one letter
    if (/^[A-Z0-9]{6}$/i.test(trimmed) && /[A-Z]/i.test(trimmed)) {
        return 3;
    }
    // 3-letter IATA code
    if (/^[A-Z]{3}$/i.test(trimmed)) {
        return 2;
    }
    return 1;
}

function selectBestRGDestination(dests: any[]): any {
    if (!dests || dests.length === 0) return null;
    const sorted = [...dests].sort((a, b) => {
        const prioA = rateGainCodePriority(a.destCode);
        const prioB = rateGainCodePriority(b.destCode);
        if (prioA !== prioB) {
            return prioB - prioA; // Higher priority first
        }
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
    return sorted[0];
}

export async function resolveForRG(query: string): Promise<string | null> {
    const normalizedQuery = query.toLowerCase().trim();

    // 0. If it's already a numeric code, return it directly
    if (/^\d+$/.test(normalizedQuery)) {
        return normalizedQuery;
    }

    const words = normalizedQuery.split(/\s+/);

    // 1. Try exact or regex match (handles "dubai" -> "dubai united arab emirates")
    const exactMatches = await RGDestinationModel.find({
        $or: [
            { destName: { $regex: `^${normalizedQuery}$`, $options: "i" } },
            { destName: { $regex: `^${normalizedQuery}`, $options: "i" } }
        ]
    }).lean();
    let dest = selectBestRGDestination(exactMatches);

    // 2. Fuzzy Text Search Fallback
    if (!dest) {
        // IMPROVEMENT: Use phrase match or limit text search to prevent broad matches
        const results = await RGDestinationModel.find(
            { $text: { $search: normalizedQuery } },
            { score: { $meta: "textScore" } }
        ).limit(5).lean();

        if (results.length > 0) {
            // Sort by textScore first, then GIATA code priority
            const sortedResults = results.sort((a: any, b: any) => {
                const scoreDiff = (b.score || 0) - (a.score || 0);
                if (Math.abs(scoreDiff) > 0.1) return scoreDiff; // Prefer significantly higher text score
                
                const prioA = rateGainCodePriority(a.destCode);
                const prioB = rateGainCodePriority(b.destCode);
                return prioB - prioA;
            });

            const firstResult = sortedResults[0]!;
            const resNameLower = firstResult.destName.toLowerCase();
            const queryWords = normalizedQuery.split(/\s+/);

            // IMPROVEMENT: Filter out generic words to find "meaningful" words
            const meaningfulWords = queryWords.filter(w => !GENERIC_WORDS.includes(w));
            
            if (meaningfulWords.length > 0) {
                // If we have meaningful words (like "francisco" in "San Francisco"), they MUST be in the result
                if (!resNameLower.includes(meaningfulWords[0]!)) {
                    console.log(`[DEBUG] resolveForRG: Rejected text match "${firstResult.destName}" for query "${query}" (missing meaningful word "${meaningfulWords[0]}")`);
                } else {
                    dest = firstResult;
                }
            } else if (queryWords.length > 1 && !resNameLower.includes(queryWords[0]!)) {
                // Fallback for when all words are technically "generic" but we want a match
                console.log(`[DEBUG] resolveForRG: Rejected text match "${firstResult.destName}" for query "${query}" (missing first word "${queryWords[0]}")`);
            } else {
                dest = firstResult;
            }
        }
    }

    // 2.5. Comma Fallback (Hotel + City searches)
    if (!dest && normalizedQuery.includes(",")) {
        const parts = normalizedQuery.split(",");
        const cityPart = parts[parts.length - 1].trim();
        if (cityPart.length > 2) {
            console.log(`[DEBUG] resolveForRG: Query has comma, falling back to city part: "${cityPart}"`);
            // Recursion safety: only recurse if we haven't already tried this part
            if (cityPart !== normalizedQuery) {
                return resolveForRG(cityPart);
            }
        }
    }

    // 3. First Word Fallback - Only as a last resort and if it's not a generic word
    if (!dest && words.length > 0 && !GENERIC_WORDS.includes(words[0]!)) {
        const fallbackMatches = await RGDestinationModel.find({
            destName: { $regex: `^${words[0]}`, $options: "i" }
        }).lean();
        dest = selectBestRGDestination(fallbackMatches);
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

    // 0. Direct ID match (e.g. "TJ:1000123")
    if (normalizedQuery.startsWith("TJ:")) {
        return [normalizedQuery.replace("TJ:", "")];
    }

    // 0.1. Direct numeric ID match (e.g. "100000010138")
    if (/^\d{8,15}$/.test(normalizedQuery)) {
        console.log(`[TripJack] Detected direct numeric HID: ${normalizedQuery}`);
        return [normalizedQuery];
    }

    const isIndianQuery = normalizedQuery.toLowerCase().includes("india") || normalizedQuery.toLowerCase().includes("goa");

    const geo = preResolvedGeo !== undefined ? preResolvedGeo : await resolveCityToCoords(normalizedQuery);

    if (geo) {
        const { lat, lng } = geo;
        console.log(`[DEBUG] resolveForTJ: Searching near [${lat}, ${lng}] for "${normalizedQuery}"`);

        // Find hotels within 20km radius
        let hotels = await HotelModel.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    $maxDistance: 20000 // 20km
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

        const uniqueHids = [...new Set(hotels.map((h) => h.tjHotelId))];
        return uniqueHids.sort(); // STABLE SORT: Ensure chunks are identical across requests
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
            cityName: { $regex: `^${normalizedQuery}$`, $options: "i" }
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

    return uniqueHids.sort(); // STABLE SORT: Essential for chunk-based pagination
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
