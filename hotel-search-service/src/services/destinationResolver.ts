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
    console.log(`[DEBUG] resolveForTJ: Performing name search for "${normalizedQuery}"`);
    
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
    const orConditions: any[] = [
        { cityName: { $regex: new RegExp(normalizedQuery, "i") } },
        { name: { $regex: new RegExp(normalizedQuery, "i") } }
    ];

    // Add significant words to search if multiple words present
    if (words.length > 0) {
        words.forEach(word => {
            orConditions.push({ cityName: { $regex: new RegExp(word, "i") } });
            orConditions.push({ name: { $regex: new RegExp(word, "i") } });
        });
    }

    const hotels = await HotelModel.find({ $or: orConditions })
        .select("tjHotelId")
        .lean();
    
    return [...new Set(hotels.map((h) => h.tjHotelId))];
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
