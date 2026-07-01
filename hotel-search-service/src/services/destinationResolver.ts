/**
 * Destination Resolver — queries MongoDB instead of in-memory Maps.
 */
import { HotelModel, IHotelData } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";
import { GeoCacheModel } from "../models/GeoCache.model";

const GENERIC_WORDS = [
  "india",
  "china",
  "usa",
  "united",
  "states",
  "kingdom",
  "arab",
  "emirates",
  "san",
  "city",
  "by",
  "the",
  "house",
  "hotel",
  "resort",
];

/**
 * Resolve a city query to a RateGain destination code.
 */
function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getRadiusFromBoundingBox(
  lat: number,
  lng: number,
  bbox: string[],
): number {
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
  // Tighter cap: city metros ~25km, large states/regions ~80km.
  // Avoids pulling in hotels from neighboring cities/states.
  return Math.min(Math.max(maxDist, 5), 80);
}

export async function seedDefaultGeo() {
  try {
    const defaults = [
      // International
      {
        query: "paris",
        lat: 48.856614,
        lng: 2.3522219,
        radiusKm: 8,
        boundingBox: ["48.815573", "48.9021449", "2.224199", "2.4699208"],
      },
      {
        query: "dubai",
        lat: 25.2048493,
        lng: 55.2707828,
        radiusKm: 80,
        boundingBox: ["24.78385", "25.35249", "54.91234", "55.61234"],
      },
      {
        query: "maldives",
        lat: 3.202778,
        lng: 73.22068,
        radiusKm: 150,
        boundingBox: ["-0.75", "7.15", "72.15", "74.15"],
      },
      {
        query: "london",
        lat: 51.5072178,
        lng: -0.1275862,
        radiusKm: 15,
        boundingBox: ["51.2867602", "51.6918741", "-0.5103751", "0.3340155"],
      },
      {
        query: "singapore",
        lat: 1.352083,
        lng: 103.819836,
        radiusKm: 25,
        boundingBox: ["1.130", "1.470", "103.600", "104.050"],
      },
      {
        query: "bangkok",
        lat: 13.7563309,
        lng: 100.5017651,
        radiusKm: 30,
        boundingBox: ["13.49", "13.95", "100.33", "100.93"],
      },
      {
        query: "bali",
        lat: -8.4095178,
        lng: 115.188919,
        radiusKm: 50,
        boundingBox: ["-8.85", "-8.10", "114.43", "115.71"],
      },
      {
        query: "new york",
        lat: 40.7127753,
        lng: -74.0059731,
        radiusKm: 20,
        boundingBox: ["40.47", "40.92", "-74.26", "-73.70"],
      },
      // India — pre-seeded so Nominatim is never called for these
      {
        query: "goa",
        lat: 15.2993265,
        lng: 74.123996,
        radiusKm: 80,
        boundingBox: ["14.8993", "15.7993", "73.6239", "74.5239"],
      },
      {
        query: "delhi",
        lat: 28.6139391,
        lng: 77.2090212,
        radiusKm: 30,
        boundingBox: ["28.40", "28.88", "76.83", "77.35"],
      },
      {
        query: "new delhi",
        lat: 28.6139391,
        lng: 77.2090212,
        radiusKm: 30,
        boundingBox: ["28.40", "28.88", "76.83", "77.35"],
      },
      {
        query: "mumbai",
        lat: 19.0759837,
        lng: 72.8776559,
        radiusKm: 30,
        boundingBox: ["18.89", "19.31", "72.77", "73.00"],
      },
      {
        query: "hyderabad",
        lat: 17.385044,
        lng: 78.486671,
        radiusKm: 25,
        boundingBox: ["17.20", "17.56", "78.27", "78.69"],
      },
      {
        query: "bangalore",
        lat: 12.9715987,
        lng: 77.5945627,
        radiusKm: 25,
        boundingBox: ["12.83", "13.14", "77.38", "77.79"],
      },
      {
        query: "bengaluru",
        lat: 12.9715987,
        lng: 77.5945627,
        radiusKm: 25,
        boundingBox: ["12.83", "13.14", "77.38", "77.79"],
      },
      {
        query: "chennai",
        lat: 13.0826802,
        lng: 80.2707184,
        radiusKm: 25,
        boundingBox: ["12.90", "13.24", "80.08", "80.46"],
      },
      {
        query: "kolkata",
        lat: 22.572646,
        lng: 88.363895,
        radiusKm: 20,
        boundingBox: ["22.45", "22.65", "88.26", "88.49"],
      },
      {
        query: "pune",
        lat: 18.521428,
        lng: 73.8544541,
        radiusKm: 20,
        boundingBox: ["18.42", "18.63", "73.74", "73.98"],
      },
      {
        query: "ahmedabad",
        lat: 23.0216238,
        lng: 72.5797068,
        radiusKm: 20,
        boundingBox: ["22.92", "23.10", "72.47", "72.69"],
      },
      {
        query: "jaipur",
        lat: 26.9124336,
        lng: 75.7872709,
        radiusKm: 20,
        boundingBox: ["26.81", "27.04", "75.67", "75.91"],
      },
      {
        query: "agra",
        lat: 27.1752554,
        lng: 78.0098161,
        radiusKm: 15,
        boundingBox: ["27.10", "27.25", "77.90", "78.14"],
      },
      {
        query: "varanasi",
        lat: 25.3176452,
        lng: 82.9739144,
        radiusKm: 15,
        boundingBox: ["25.25", "25.40", "82.88", "83.09"],
      },
      {
        query: "kochi",
        lat: 9.9312328,
        lng: 76.2673041,
        radiusKm: 20,
        boundingBox: ["9.85", "10.02", "76.17", "76.40"],
      },
      {
        query: "cochin",
        lat: 9.9312328,
        lng: 76.2673041,
        radiusKm: 20,
        boundingBox: ["9.85", "10.02", "76.17", "76.40"],
      },
      {
        query: "udaipur",
        lat: 24.5854364,
        lng: 73.71249,
        radiusKm: 15,
        boundingBox: ["24.52", "24.64", "73.63", "73.82"],
      },
      {
        query: "manali",
        lat: 32.2396,
        lng: 77.1887,
        radiusKm: 20,
        boundingBox: ["32.15", "32.35", "77.08", "77.33"],
      },
      {
        query: "shimla",
        lat: 31.1048,
        lng: 77.1734,
        radiusKm: 15,
        boundingBox: ["31.03", "31.18", "77.07", "77.27"],
      },
      {
        query: "ooty",
        lat: 11.4102,
        lng: 76.695,
        radiusKm: 15,
        boundingBox: ["11.34", "11.47", "76.62", "76.80"],
      },
      {
        query: "coorg",
        lat: 12.4213,
        lng: 75.7382,
        radiusKm: 25,
        boundingBox: ["12.27", "12.56", "75.56", "75.96"],
      },
      {
        query: "rishikesh",
        lat: 30.0869,
        lng: 78.2676,
        radiusKm: 15,
        boundingBox: ["30.03", "30.15", "78.19", "78.38"],
      },
    ];

    // Upsert all defaults — runs every startup so new entries are always seeded
    const ops = defaults.map((d) => ({
      updateOne: {
        filter: { query: d.query },
        update: { $setOnInsert: d }, // only insert if not exists; don't overwrite manual updates
        upsert: true,
      },
    }));
    await GeoCacheModel.bulkWrite(ops, { ordered: false });
    console.log(
      `[GEO] Seeded/verified ${defaults.length} default geo entries.`,
    );
  } catch (err: any) {
    console.error("[GEO] Seeding error:", err.message);
  }
}

/**
 * Attempt to find coordinates for a given city query using database cache or external geocoding.
 */
export async function resolveCityToCoords(
  query: string,
): Promise<{ lat: number; lng: number; radiusKm: number } | null> {
  if (!query || query.length < 2) return null;
  const normalizedQuery = query.toLowerCase().trim();

  // Instant coordinates extraction if prefixed with "geo:"
  if (normalizedQuery.startsWith("geo:")) {
    const coords = normalizedQuery.replace("geo:", "").split(",");
    if (coords.length === 2) {
      const lat = parseFloat(coords[0]);
      const lng = parseFloat(coords[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`[GEO] Instantly parsing query "${query}" as coords: [${lat}, ${lng}]`);
        return { lat, lng, radiusKm: 25 };
      }
    }
  }

  // 0. Check Database Cache
  try {
    const cached = await GeoCacheModel.findOne({
      query: normalizedQuery,
    }).lean();
    if (cached) {
      console.log(
        `[GEO] Cache HIT for "${query}": [${cached.lat}, ${cached.lng}], radius: ${cached.radiusKm}km`,
      );
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
    const axios = require("axios");

    let response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery)}&limit=1`,
      {
        headers: { "User-Agent": "Klar-Hotel-Search-Service/1.0" },
        timeout: 5000,
      },
    );

    if (
      (!response.data || response.data.length === 0) &&
      !normalizedQuery.includes(",")
    ) {
      console.log(
        `[GEO] No results for "${normalizedQuery}", retrying with India suffix...`,
      );
      response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery + ", India")}&limit=1`,
        {
          headers: { "User-Agent": "Klar-Hotel-Search-Service/1.0" },
          timeout: 5000,
        },
      );
    }

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      lat = parseFloat(result.lat);
      lng = parseFloat(result.lon);
      boundingBox = result.boundingbox || [];
      radiusKm = getRadiusFromBoundingBox(lat, lng, boundingBox);
      console.log(
        `[GEO] Nominatim resolved "${query}" to [${lat}, ${lng}] with dynamic radius: ${radiusKm.toFixed(2)}km`,
      );
    }
  } catch (error: any) {
    console.error(`[GEO] Nominatim error for "${query}":`, error.message);
  }

  // Strategy 2: Fallback to exact city name match in our database (if Nominatim fails/misses)
  if (lat === null || lng === null) {
    try {
      console.log(
        `[GEO] Nominatim fallback failed. Checking DB exact matches for "${query}"...`,
      );
      const capitalizeWord = (s: string) =>
        s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      const tryFindCity = async (cityName: string) => {
        const capitalized = capitalizeWord(cityName);
        let found = await HotelModel.findOne({ cityName: capitalized })
          .select("location")
          .lean();
        if (!found) {
          found = await HotelModel.findOne({
            cityName: {
              $in: [cityName.toLowerCase(), cityName.toUpperCase(), cityName],
            },
          })
            .select("location")
            .lean();
        }
        if (!found) {
          found = await HotelModel.findOne({
            cityName: { $regex: `^${cityName}$`, $options: "i" },
          })
            .select("location")
            .lean();
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
          (lng + 0.2).toString(),
        ];
        console.log(
          `[GEO] Resolved "${query}" from DB to [${lat}, ${lng}] (Default radius: ${radiusKm}km)`,
        );
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
        { upsert: true, new: true },
      );
      console.log(`[GEO] Saved resolved geo for "${query}" to DB cache.`);
      return { lat, lng, radiusKm };
    } catch (saveErr: any) {
      console.error(
        `[GEO] Failed to save cache entry for "${query}":`,
        saveErr.message,
      );
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
    return (
      new Date(b.updatedAt || 0).getTime() -
      new Date(a.updatedAt || 0).getTime()
    );
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
  const escapedQuery = normalizedQuery.replace(
    /[-[\]{}()*+?.,\\^$|#\s]/g,
    "\\$&",
  );

  // Run exact match and text search IN PARALLEL instead of sequentially
  const [exactMatches, textResults] = await Promise.all([
    RGDestinationModel.find({
      $or: [
        { destName: { $regex: `^${escapedQuery}$`, $options: "i" } },
        { destName: { $regex: `^${escapedQuery}`, $options: "i" } },
      ],
    }).lean(),
    RGDestinationModel.find(
      { $text: { $search: normalizedQuery } },
      { score: { $meta: "textScore" } },
    )
      .limit(5)
      .lean(),
  ]);

  let dest = selectBestRGDestination(exactMatches);

  // 2. Fuzzy Text Search Fallback
  if (!dest && textResults.length > 0) {
    const sortedResults = textResults.sort((a: any, b: any) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      const prioA = rateGainCodePriority(a.destCode);
      const prioB = rateGainCodePriority(b.destCode);
      return prioB - prioA;
    });

    const firstResult = sortedResults[0]!;
    const resNameLower = firstResult.destName.toLowerCase();
    const queryWords = normalizedQuery.split(/\s+/);
    const meaningfulWords = queryWords.filter(
      (w) => !GENERIC_WORDS.includes(w),
    );

    if (meaningfulWords.length > 0) {
      if (resNameLower.includes(meaningfulWords[0]!)) {
        dest = firstResult;
      } else {
        console.log(
          `[DEBUG] resolveForRG: Rejected text match "${firstResult.destName}" for query "${query}"`,
        );
      }
    } else if (
      queryWords.length > 1 &&
      !resNameLower.includes(queryWords[0]!)
    ) {
      console.log(
        `[DEBUG] resolveForRG: Rejected text match "${firstResult.destName}" for query "${query}"`,
      );
    } else {
      dest = firstResult;
    }
  }

  // 2.5. Comma Fallback (Hotel + City searches)
  if (!dest && normalizedQuery.includes(",")) {
    const parts = normalizedQuery.split(",");
    const cityPart = parts[parts.length - 1].trim();
    if (cityPart.length > 2 && cityPart !== normalizedQuery) {
      console.log(
        `[DEBUG] resolveForRG: Comma fallback to city part: "${cityPart}"`,
      );
      return resolveForRG(cityPart);
    }
  }

  // 3. First Word Fallback
  if (!dest && words.length > 0 && !GENERIC_WORDS.includes(words[0]!)) {
    const fallbackMatches = await RGDestinationModel.find({
      destName: { $regex: `^${words[0]}`, $options: "i" },
    }).lean();
    dest = selectBestRGDestination(fallbackMatches);
  }

  const result = dest?.destCode || null;
  console.log(
    `[DEBUG] resolveForRG: Resolved "${query}" to ${result} (Name: ${dest?.destName})`,
  );
  return result;
}

/**
 * Resolve a city query to an array of TripJack hotel IDs.
 */
export async function resolveForTJ(
  query: string,
  preResolvedGeo?: { lat: number; lng: number; radiusKm?: number } | null,
): Promise<string[]> {
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

  const isIndianQuery =
    normalizedQuery.toLowerCase().includes("india") ||
    normalizedQuery.toLowerCase().includes("goa");

  // If preResolvedGeo is explicitly null (geo resolution failed), fall through to name search.
  // Only use preResolvedGeo if it's a valid object with coordinates.
  const geo =
    preResolvedGeo && preResolvedGeo.lat && preResolvedGeo.lng
      ? preResolvedGeo
      : preResolvedGeo === undefined
        ? await resolveCityToCoords(normalizedQuery)
        : null;

  if (geo) {
    const { lat, lng } = geo;
    const radiusKm = geo.radiusKm || 20;
    console.log(
      `[DEBUG] resolveForTJ: Searching near [${lat}, ${lng}] with radius ${radiusKm}km for "${normalizedQuery}"`,
    );

    // Find hotels within dynamic radius
    let hotels = await HotelModel.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: radiusKm * 1000, // dynamic radius in meters
        },
      },
    })
      .select("tjHotelId countryName")
      .lean();

    // Sanity Check: If searching for India but resolved to Germany (or vice versa), filter out
    if (isIndianQuery) {
      hotels = hotels.filter(
        (h) =>
          !h.countryName ||
          h.countryName.toLowerCase().includes("india") ||
          !h.countryName.toLowerCase().includes("germany"),
      );
    }

    // Preserve MongoDB $near distance order (closest hotels first).
    // De-duplicate while keeping insertion order (closest first).
    const seen = new Set<string>();
    const uniqueHids: string[] = [];
    for (const h of hotels) {
      if (h.tjHotelId && !seen.has(h.tjHotelId)) {
        seen.add(h.tjHotelId);
        uniqueHids.push(h.tjHotelId);
      }
    }
    return uniqueHids;
  }

  // 2. City/Hotel Name Search (Fallback if no Geo available)
  console.log(
    `[DEBUG] resolveForTJ: Performing hierarchical fuzzy search for "${normalizedQuery}"`,
  );

  // Step A: Attempt Text Search
  let hotels = await HotelModel.find({
    $text: { $search: normalizedQuery },
  })
    .select("tjHotelId countryName")
    .lean();

  // Step B: Fallback to Phrase Regex
  if (hotels.length < 5) {
    const regexHotels = await HotelModel.find({
      cityName: { $regex: `^${normalizedQuery}$`, $options: "i" },
    })
      .select("tjHotelId countryName")
      .lean();

    if (regexHotels.length > hotels.length) {
      hotels = regexHotels;
    }
  }

  // Geographic filtering for text/regex results too
  if (isIndianQuery) {
    hotels = hotels.filter(
      (h) =>
        !h.countryName ||
        h.countryName.toLowerCase().includes("india") ||
        !h.countryName.toLowerCase().includes("germany"),
    );
  }

  // Preserve insertion order (text search relevance score order).
  const seen2 = new Set<string>();
  const uniqueHids: string[] = [];
  for (const h of hotels) {
    if (h.tjHotelId && !seen2.has(h.tjHotelId)) {
      seen2.add(h.tjHotelId);
      uniqueHids.push(h.tjHotelId);
    }
  }
  console.log(
    `[DEBUG] resolveForTJ: Resolved "${normalizedQuery}" to ${uniqueHids.length} hotels`,
  );
  return uniqueHids;
}

/**
 * Get static hotel data for a TripJack hotel ID (for enrichment).
 */
export async function getHotelStaticData(
  tjHotelId: string,
): Promise<IHotelData | null> {
  return HotelModel.findOne({ tjHotelId }).lean() as Promise<IHotelData | null>;
}

/**
 * Batch get static data for multiple TJ hotel IDs (more efficient).
 */
export async function getHotelStaticDataBatch(
  tjHotelIds: string[],
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
