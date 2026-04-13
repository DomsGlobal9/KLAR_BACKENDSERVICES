/**
 * Destination Resolver — queries MongoDB instead of in-memory Maps.
 */
import { HotelModel, IHotelData } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";

/**
 * Resolve a city query to a RateGain destination code.
 */
export async function resolveForRG(query: string): Promise<string | null> {
    const normalizedQuery = query.toLowerCase().trim();
    const words = normalizedQuery.split(/\s+/);

    // 1. Try exact or regex match (handles "dubai" -> "dubai united arab emirates")
    let dest = await RGDestinationModel.findOne({
        $or: [
            { destName: normalizedQuery },
            { destName: { $regex: new RegExp(`^${normalizedQuery}`, "i") } }
        ]
    });

    // 2. If no match, try checking if the first word matches exactly (handles "delhi india" -> "delhi")
    if (!dest && words.length > 0) {
        dest = await RGDestinationModel.findOne({ destName: words[0] });
    }

    return dest?.destCode || null;
}

/**
 * Resolve a city query to an array of TripJack hotel IDs (max 300).
 */
export async function resolveForTJ(query: string): Promise<string[]> {
    const normalizedQuery = query.trim();
    
    // 1. Check if the query is in lat,long format
    const coordRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
    const match = normalizedQuery.match(coordRegex);

    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[3]);
        
        console.log(`[DEBUG] resolveForTJ: Detected coordinates [${lat}, ${lng}]. Performing geospatial search.`);
        
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
        .limit(300)
        .lean();

        return [...new Set(hotels.map((h) => h.tjHotelId))];
    }

    // 2. City/Hotel Name Search
    console.log(`[DEBUG] resolveForTJ: Performing hierarchical search for "${normalizedQuery}"`);
    
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
    
    // Step A: Full phrase match on cityName (e.g. "New Delhi")
    let hotels = await HotelModel.find({
        cityName: { $regex: new RegExp(normalizedQuery, "i") }
    }).select("tjHotelId").limit(300).lean();

    // Step B: If no match, try AND-based search across Name, City, and Country
    if (hotels.length === 0) {
        // Every word must appear in either Name, City, or Country
        const andConditions = words.map(word => ({
            $or: [
                { cityName: { $regex: new RegExp(word, "i") } },
                { name: { $regex: new RegExp(word, "i") } },
                { countryName: { $regex: new RegExp(word, "i") } }
            ]
        }));

        if (andConditions.length > 0) {
            hotels = await HotelModel.find({ $and: andConditions })
                .select("tjHotelId")
                .limit(300)
                .lean();
        }
    }

    // Step C: Fallback for very short or no-match queries (back to original behavior but slightly more restricted)
    if (hotels.length === 0) {
        hotels = await HotelModel.find({
            $or: [
                { cityName: { $regex: new RegExp(normalizedQuery, "i") } },
                { name: { $regex: new RegExp(normalizedQuery, "i") } }
            ]
        }).select("tjHotelId").limit(300).lean();
    }
    
    const uniqueHids = [...new Set(hotels.map((h: any) => h.tjHotelId).filter(Boolean))];
    console.log(`[DEBUG] resolveForTJ: Resolved "${normalizedQuery}" to ${uniqueHids.length} hotels.`);
    
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
