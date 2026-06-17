/**
 * Destination Resolver — queries MongoDB instead of in-memory Maps.
 */
import { HotelModel, IHotelData } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";
import { GeoCacheModel } from "../models/GeoCache.model";

const GENERIC_WORDS = ['india', 'china', 'usa', 'united', 'states', 'kingdom', 'arab', 'emirates', 'san', 'city', 'by', 'the', 'house', 'hotel', 'resort'];

/**
 * Resolve a city query to a RateGain destination code.
 */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getRadiusFromBoundingBox(lat: number, lng: number, bbox: string[]): number {
    if (!bbox || bbox.length !== 4) return 20; // 20km fallback
    const minLat = parseFloat(bbox[0]);
    const maxLat = parseFloat(bbox[1]);
    const minLng = parseFloat(bbox[2]);
    const maxLng = parseFloat(bbox[3]);

    const d1 = getDistanceKm(lat, lng, minLat, minLng);
    const d2 = getDistanceKm(lat, lng, minLat, maxLng);
    const d3 = getDistanceKm(lat, lng, maxLat, minLng);
    const d4 = getDistanceKm(lat, lng, maxLat, maxLng);

    const maxDist = Math.max(d1, d2, d3, d4);
    return Math.min(Math.max(maxDist, 5), 100); // Limit to range [5km, 100km]
}

export async function seedDefaultGeo() {
    try {
        const count = await GeoCacheModel.countDocuments();
        if (count === 0) {
            console.log("[GEO] GeoCache is empty. Seeding default popular destinations...");
            const defaults = [
                { query: "paris", lat: 48.856614, lng: 2.3522219, radiusKm: 8, boundingBox: ["48.815573", "48.9021449", "2.224199", "2.4699208"] },
                { query: "dubai", lat: 25.2048493, lng: 55.2707828, radiusKm: 80, boundingBox: ["24.78385", "25.35249", "54.91234", "55.61234"] },
                { query: "goa", lat: 15.2993265, lng: 74.123996, radiusKm: 80, boundingBox: ["14.8993", "15.7993", "73.6239", "74.5239"] },
                { query: "maldives", lat: 3.202778, lng: 73.22068, radiusKm: 150, boundingBox: ["-0.75", "7.15", "72.15", "74.15"] },
                { query: "london", lat: 51.5072178, lng: -0.1275862, radiusKm: 15, boundingBox: ["51.2867602", "51.6918741", "-0.5103751", "0.3340155"] },
                { query: "delhi", lat: 28.6139391, lng: 77.2090212, radiusKm: 30, boundingBox: ["28.40", "28.88", "76.83", "77.35"] },
                { query: "mumbai", lat: 19.0759837, lng: 72.8776559, radiusKm: 30, boundingBox: ["18.89", "19.31", "72.77", "73.00"] },
                { query: "singapore", lat: 1.352083, lng: 103.819836, radiusKm: 25, boundingBox: ["1.130", "1.470", "103.600", "104.050"] }
            ];
            await GeoCacheModel.insertMany(defaults);
            console.log(`[GEO] Successfully seeded ${defaults.length} default destinations.`);
        }
    } catch (err: any) {
        console.error("[GEO] Seeding error:", err.message);
    }
}

/**
 * Attempt to find coordinates for a given city query using database cache or external geocoding.
 */
export async function resolveCityToCoords(query: string): Promise<{ lat: number; lng: number; radiusKm: number } | null> {
    if (!query || query.length < 2) return null;
    const normalizedQuery = query.toLowerCase().trim();

    // 0. Check Database Cache
    try {
        const cached = await GeoCacheModel.findOne({ query: normalizedQuery }).lean();
        if (cached) {
            console.log(`[GEO] Cache HIT for "${query}": [${cached.lat}, ${cached.lng}], radius: ${cached.radiusKm}km`);
            return { lat: cached.lat, lng: cached.lng, radiusKm: cached.radiusKm };
        }
    } catch (err: any) {
        console.error(`[GEO] Cache read error for "${query}":`, err.message);
    }

    let lat: number | null = null;
    let lng: number | null = null;
    let radiusKm = 20;
    let boundingBox: string[] = [];

    // Strategy 1: Geocoding via Nominatim (to get coordinates + bounding box)
    try {
        console.log(`[GEO] Cache MISS for "${query}". Fetching from Nominatim...`);
        const axios = require('axios');
        
        let response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery)}&limit=1`, {
            headers: { 'User-Agent': 'Klar-Hotel-Search-Service/1.0' },
            timeout: 5000
        });

        if ((!response.data || response.data.length === 0) && !normalizedQuery.includes(",")) {
            console.log(`[GEO] No results for "${normalizedQuery}", retrying with India suffix...`);
            response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery + ", India")}&limit=1`, {
                headers: { 'User-Agent': 'Klar-Hotel-Search-Service/1.0' },
                timeout: 5000
            });
        }

        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            lat = parseFloat(result.lat);
            lng = parseFloat(result.lon);
            boundingBox = result.boundingbox || [];
            radiusKm = getRadiusFromBoundingBox(lat, lng, boundingBox);
            console.log(`[GEO] Nominatim resolved "${query}" to [${lat}, ${lng}] with dynamic radius: ${radiusKm.toFixed(2)}km`);
        }
    } catch (error: any) {
        console.error(`[GEO] Nominatim error for "${query}":`, error.message);
    }

    // Strategy 2: Fallback to exact city name match in our database (if Nominatim fails/misses)
    if (lat === null || lng === null) {
        try {
            console.log(`[GEO] Nominatim fallback failed. Checking DB exact matches for "${query}"...`);
            const capitalizeWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
            const tryFindCity = async (cityName: string) => {
                const capitalized = capitalizeWord(cityName);
                let found = await HotelModel.findOne({ cityName: capitalized }).select("location").lean();
                if (!found) {
                    found = await HotelModel.findOne({ 
                        cityName: { $in: [cityName.toLowerCase(), cityName.toUpperCase(), cityName] } 
                    }).select("location").lean();
                }
                if (!found) {
                    found = await HotelModel.findOne({
                        cityName: { $regex: `^${cityName}$`, $options: "i" }
                    }).select("location").lean();
                }
                return found;
            };

            let hotel = await tryFindCity(normalizedQuery);
            if (!hotel && normalizedQuery.split(/[\s,]+/).length > 1) {
                const firstPart = normalizedQuery.split(/[\s,]+/)[0];
                hotel = await tryFindCity(firstPart);
            }

            if (hotel?.location?.coordinates) {
                const [dbLng, dbLat] = hotel.location.coordinates;
                lat = dbLat;
                lng = dbLng;
                radiusKm = 20; // default fallback radius
                boundingBox = [
                    (lat - 0.2).toString(),
                    (lat + 0.2).toString(),
                    (lng - 0.2).toString(),
                    (lng + 0.2).toString()
                ];
                console.log(`[GEO] Resolved "${query}" from DB to [${lat}, ${lng}] (Default radius: ${radiusKm}km)`);
            }
        } catch (dbErr: any) {
            console.error(`[GEO] DB fallback search error:`, dbErr.message);
        }
    }

    // 3. Save to database cache if resolved
    if (lat !== null && lng !== null) {
        try {
            await GeoCacheModel.findOneAndUpdate(
                { query: normalizedQuery },
                { lat, lng, radiusKm, boundingBox },
                { upsert: true, new: true }
            );
            console.log(`[GEO] Saved resolved geo for "${query}" to DB cache.`);
            return { lat, lng, radiusKm };
        } catch (saveErr: any) {
            console.error(`[GEO] Failed to save cache entry for "${query}":`, saveErr.message);
            return { lat, lng, radiusKm };
        }
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
export async function resolveForTJ(query: string, preResolvedGeo?: { lat: number; lng: number; radiusKm?: number } | null): Promise<string[]> {
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
        const radiusKm = geo.radiusKm || 20;
        console.log(`[DEBUG] resolveForTJ: Searching near [${lat}, ${lng}] with radius ${radiusKm}km for "${normalizedQuery}"`);

        // Find hotels within dynamic radius
        let hotels = await HotelModel.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    $maxDistance: radiusKm * 1000 // dynamic radius in meters
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
