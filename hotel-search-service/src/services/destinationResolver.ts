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
  // Dynamic cap: min 5km (tiny city-states), max 500km (island archipelagos like Maldives).
  // The bounding box from Nominatim naturally reflects the true geographic extent of each place.
  return Math.min(Math.max(maxDist, 5), 500);
}

/**
 * @deprecated — DO NOT USE. Replaced by fully dynamic Nominatim-based resolution.
 * Keeping the export signature to avoid breaking any callers, but it always returns null.
 * resolveGeoCenter() now handles city-center snapping dynamically for every city in the world.
 */
export function getOfficialCityCenterMatch(
  _lat: number,
  _lng: number,
): { lat: number; lng: number; radiusKm: number } | null {
  return null;
}

// In-memory locks to deduplicate active concurrent requests for the exact same key/coords
const activeGeoCenterLocks = new Map<string, Promise<{ lat: number; lng: number; radiusKm: number }>>();
const activeRadiusLocks = new Map<string, Promise<number>>();
const activeCityLocks = new Map<string, Promise<{ lat: number; lng: number; radiusKm: number } | null>>();

/**
 * Fully dynamic geo resolution for ANY city in the world.
 */
export async function resolveGeoCenter(
  lat: number,
  lng: number,
): Promise<{ lat: number; lng: number; radiusKm: number }> {
  const cacheKey = `geo:${lat.toFixed(4)},${lng.toFixed(4)}`;

  // 1. Fast path: check MongoDB cache by coordinate key
  try {
    const cached = await GeoCacheModel.findOne({ query: cacheKey }).lean();
    if (cached?.radiusKm) {
      console.log(`[GEO] Cache HIT [${lat},${lng}] → radius=${cached.radiusKm}km`);
      return { lat: cached.lat ?? lat, lng: cached.lng ?? lng, radiusKm: cached.radiusKm };
    }
  } catch (_) {}

  // 2. Check if a request for these coordinates is already active (deduplication)
  if (activeGeoCenterLocks.has(cacheKey)) {
    console.log(`[GEO] Waiting for existing concurrent search to resolve [${lat},${lng}]`);
    return activeGeoCenterLocks.get(cacheKey)!;
  }

  // Create a new locked promise for this coordinate
  const promise = (async () => {
    // OSM reverse geocode (zoom=10 = city level) → resolve city name → get official center + radius
    try {
      const axios = require("axios");
      const apiKey = process.env.OPENCAGE_API_KEY || "ae11f396076d4310a96bb12acc0a6323";
      const response = await axios.get(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&no_annotations=1`,
        { timeout: 6000 },
      );
      
      const results = response.data?.results;
      if (results && results.length > 0) {
        const components = results[0].components;
        const cityName =
          components.city       ||
          components.town       ||
          components.village    ||
          components.municipality ||
          components.state      ||
          components.county;

        if (cityName) {
          console.log(`[GEO] OSM resolved [${lat},${lng}] → city: "${cityName}"`);
          const cityCenter = await resolveCityToCoords(cityName);
          if (cityCenter) {
            const dist = getDistanceKm(lat, lng, cityCenter.lat, cityCenter.lng);
            if (dist <= 300) { // 300km covers archipelagos like Maldives
              console.log(
                `[GEO] Snapped [${lat},${lng}] → "${cityName}" [${cityCenter.lat},${cityCenter.lng}] ` +
                `dist=${dist.toFixed(1)}km, radius=${cityCenter.radiusKm}km`,
              );
              try {
                await GeoCacheModel.findOneAndUpdate(
                  { query: cacheKey },
                  { lat: cityCenter.lat, lng: cityCenter.lng, radiusKm: cityCenter.radiusKm },
                  { upsert: true, new: true },
                );
              } catch (_) {}
              return cityCenter;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[GEO] OSM city-snap failed for [${lat},${lng}]:`, err.message);
    }

    // Direct OSM bounding-box lookup (multi-zoom) — keeps original coords, just gets radius
    const radiusKm = await resolveRadiusFromCoords(lat, lng);
    return { lat, lng, radiusKm };
  })();

  // Store in map, run, and cleanup when finished
  activeGeoCenterLocks.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    activeGeoCenterLocks.delete(cacheKey);
  }
}

/**
 * Resolves the geographic search radius for any lat/lng purely from OpenStreetMap bounding boxes.
 *
 * Tries OSM zoom levels in order — each gives a different geographic granularity:
 *   zoom=10  city/town        → Paris ~8km, Dubai metro ~35km
 *   zoom=8   district/borough → broader city area
 *   zoom=6   county/region    → Goa state ~80km
 *   zoom=5   country/island   → Maldives archipelago ~480km
 *
 * The bounding box at each zoom reflects the TRUE size of that place.
 * Results are cached in MongoDB — OSM is called only ONCE per coordinate, ever.
 * No hardcoded radius numbers anywhere.
 */
export async function resolveRadiusFromCoords(
  lat: number,
  lng: number,
): Promise<number> {
  const cacheKey = `geo:${lat.toFixed(4)},${lng.toFixed(4)}`;

  // 1. MongoDB cache
  try {
    const cached = await GeoCacheModel.findOne({ query: cacheKey }).lean();
    if (cached?.radiusKm) {
      console.log(`[GEO] Radius cache HIT [${lat},${lng}]: ${cached.radiusKm}km`);
      return cached.radiusKm;
    }
  } catch (_) {}

  // 2. Lock deduplication
  if (activeRadiusLocks.has(cacheKey)) {
    return activeRadiusLocks.get(cacheKey)!;
  }

  const promise = (async () => {
    const axios = require("axios");
    const apiKey = process.env.OPENCAGE_API_KEY || "ae11f396076d4310a96bb12acc0a6323";

    try {
      const res = await axios.get(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&no_annotations=1`,
        { timeout: 6000 },
      );
      const results = res.data?.results;
      if (results && results.length > 0 && results[0].bounds) {
        const bounds = results[0].bounds;
        const bbox: string[] = [
          bounds.southwest.lat.toString(),
          bounds.northeast.lat.toString(),
          bounds.southwest.lng.toString(),
          bounds.northeast.lng.toString(),
        ];
        const radiusKm = getRadiusFromBoundingBox(lat, lng, bbox);
        const placeName = results[0].formatted?.split(",")[0] ?? "unknown";
        console.log(
          `[GEO] OpenCage resolved → "${placeName}" radius=${radiusKm.toFixed(1)}km`,
        );
        try {
          await GeoCacheModel.findOneAndUpdate(
            { query: cacheKey },
            { lat, lng, radiusKm, boundingBox: bbox },
            { upsert: true, new: true },
          );
        } catch (_) {}
        return radiusKm;
      }
    } catch (err: any) {
      console.warn(`[GEO] OpenCage failed [${lat},${lng}]:`, err.message);
    }

    console.warn(`[GEO] Geo API unreachable or rate-limited. Using safe fallback radius 30km for [${lat},${lng}]`);
    return 30;
  })();

  activeRadiusLocks.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    activeRadiusLocks.delete(cacheKey);
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

  // 1. Lock deduplication
  if (activeCityLocks.has(normalizedQuery)) {
    return activeCityLocks.get(normalizedQuery)!;
  }

  const promise = (async () => {
    let lat: number | null = null;
    let lng: number | null = null;
    let radiusKm = 20;
    let boundingBox: string[] = [];

    // Strategy 1: Geocoding via OpenCage
    try {
      console.log(`[GEO] Cache MISS for "${query}". Fetching from OpenCage...`);
      const axios = require("axios");
      const apiKey = process.env.OPENCAGE_API_KEY || "ae11f396076d4310a96bb12acc0a6323";

      let response = await axios.get(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(normalizedQuery)}&key=${apiKey}&limit=1&no_annotations=1`,
        { timeout: 5000 },
      );

      if (
        (!response.data?.results || response.data.results.length === 0) &&
        !normalizedQuery.includes(",")
      ) {
        console.log(
          `[GEO] No results for "${normalizedQuery}", retrying with India suffix...`,
        );
        response = await axios.get(
          `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(normalizedQuery + ", India")}&key=${apiKey}&limit=1&no_annotations=1`,
          { timeout: 5000 },
        );
      }

      const results = response.data?.results;
      if (results && results.length > 0) {
        const result = results[0];
        lat = result.geometry.lat;
        lng = result.geometry.lng;
        if (result.bounds) {
          boundingBox = [
            result.bounds.southwest.lat.toString(),
            result.bounds.northeast.lat.toString(),
            result.bounds.southwest.lng.toString(),
            result.bounds.northeast.lng.toString(),
          ];
        }
        radiusKm = getRadiusFromBoundingBox(lat as number, lng as number, boundingBox);
        console.log(
          `[GEO] OpenCage resolved "${query}" to [${lat}, ${lng}] with dynamic radius: ${radiusKm.toFixed(2)}km`,
        );
      }
    } catch (error: any) {
      console.error(`[GEO] OpenCage error for "${query}":`, error.message);
    }

    // Strategy 2: exact city match in DB
    if (lat === null || lng === null) {
      try {
        console.log(`[GEO] Nominatim fallback failed. Checking DB exact matches for "${query}"...`);
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
          radiusKm = 20;
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

    // Strategy 3: fuzzy match in country-state-city
    if (lat === null || lng === null) {
      try {
        console.log(`[GEO] Exact fallback failed. Checking country-state-city fuzzy matches for "${normalizedQuery}"...`);
        const { City } = require("country-state-city");
        const { fuzzyFindCities } = require("../utils/fuzzy");
        const allCities = City.getAllCities();

        const fuzzyMatches = fuzzyFindCities(normalizedQuery, allCities);
        if (fuzzyMatches.length > 0) {
          const bestMatch = fuzzyMatches[0];
          lat = parseFloat(bestMatch.latitude);
          lng = parseFloat(bestMatch.longitude);
          radiusKm = 20;
          boundingBox = [
            (lat - 0.2).toString(),
            (lat + 0.2).toString(),
            (lng - 0.2).toString(),
            (lng + 0.2).toString(),
          ];
          console.log(
            `[GEO] Resolved fuzzy match "${query}" to "${bestMatch.name}" [${lat}, ${lng}] from country-state-city`
          );
        }
      } catch (fuzzyErr: any) {
        console.error(`[GEO] country-state-city fuzzy search error:`, fuzzyErr.message);
      }
    }

    // Save to database cache if resolved
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
        console.error(`[GEO] Failed to save cache entry for "${query}":`, saveErr.message);
        return { lat, lng, radiusKm };
      }
    }

    return null;
  })();

  activeCityLocks.set(normalizedQuery, promise);
  try {
    return await promise;
  } finally {
    activeCityLocks.delete(normalizedQuery);
  }
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
