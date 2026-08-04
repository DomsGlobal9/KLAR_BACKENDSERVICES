import { RGDestinationModel } from "../models/RGDestination.model";
import { HotelModel } from "../models/Hotel.model";
import { isMongoReady } from "../utils/mongoReady";

export interface TopCity {
  name: string;
  country: string;
  hotelCount: number;
}

/**
 * Top cities are derived from our own synced inventory, which is the only source
 * that can promise the tile actually lands on hotels. A hand-written list cannot:
 * "Capital of Italy" was a real tile, and it searched for exactly that string.
 *
 * The aggregation is cheap per country thanks to the {countryName, cityName}
 * index, and the answer changes only when the catalogue re-syncs, so it is held
 * for hours rather than recomputed per visitor.
 */
const TOP_CITIES_TTL_MS = Number(process.env.TOP_CITIES_TTL_MS || 6 * 60 * 60 * 1000);
/** Long enough not to hammer a struggling database, short enough to self-heal. */
const TOP_CITIES_RETRY_MS = 60 * 1000;
const TOP_CITIES_BUDGET_MS = Number(process.env.TOP_CITIES_BUDGET_MS || 4000);

const topCitiesCache = new Map<string, { value: TopCity[]; fetchedAt: number }>();
/** Collapses the stampede when several tiles mount at once on a cold cache. */
const topCitiesInFlight = new Map<string, Promise<TopCity[]>>();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "new delhi" → "New Delhi". Supplier rows arrive in mixed case. */
const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

class DestinationsService {
  /**
   * Cities of `country` ordered by how much inventory we hold there.
   *
   * Never throws and never blocks a page: on a cold cache with a slow database
   * it resolves empty within the budget, and the caller falls back to its own
   * curated list.
   */
  async getTopCities(country: string, limit = 12): Promise<TopCity[]> {
    const key = `${country.toLowerCase()}::${limit}`;

    const cached = topCitiesCache.get(key);
    if (cached) {
      const ttl = cached.value.length ? TOP_CITIES_TTL_MS : TOP_CITIES_RETRY_MS;
      if (Date.now() - cached.fetchedAt < ttl) return cached.value;
    }

    const inFlight = topCitiesInFlight.get(key);
    if (inFlight) return inFlight;

    if (!isMongoReady()) return cached?.value ?? [];

    const promise = (async () => {
      try {
        const rows = await HotelModel.aggregate([
          { $match: { countryName: new RegExp(`^${escapeRegex(country)}$`, "i") } },
          {
            $group: {
              _id: { $toLower: "$cityName" },
              name: { $first: "$cityName" },
              country: { $first: "$countryName" },
              hotelCount: { $sum: 1 },
            },
          },
          { $sort: { hotelCount: -1 } },
          { $limit: limit },
        ])
          .option({ maxTimeMS: TOP_CITIES_BUDGET_MS })
          .exec();

        const value: TopCity[] = rows
          .filter((r: any) => r.name)
          .map((r: any) => ({
            name: titleCase(String(r.name).trim()),
            country: r.country || country,
            hotelCount: r.hotelCount,
          }));

        topCitiesCache.set(key, { value, fetchedAt: Date.now() });
        return value;
      } catch (error: any) {
        console.error(
          `[Destinations] Top cities for "${country}" failed:`,
          error.message,
        );
        // Cache the empty answer briefly so a broken database does not turn every
        // landing-page render into another 4-second wait.
        topCitiesCache.set(key, { value: [], fetchedAt: Date.now() });
        return [];
      } finally {
        topCitiesInFlight.delete(key);
      }
    })();

    topCitiesInFlight.set(key, promise);
    return promise;
  }

  async getDestinations() {
    // Use MongoDB aggregation to deduplicate by destName (case-insensitive) at the database level
    const uniqueDestinations = await RGDestinationModel.aggregate([
      {
        $group: {
          _id: {
            $toLower: {
              $trim: {
                input: {
                  $arrayElemAt: [{ $split: ["$destName", ","] }, 0],
                },
              },
            },
          },
          destCode: { $first: "$destCode" },
          destName: { $first: "$destName" },
          countryName: { $first: "$countryName" },
        },
      },
    ]);

    return {
      status: true,
      body: uniqueDestinations.map((dest) => ({
        destCode: dest.destCode,
        destName: dest.destName,
        countryName: dest.countryName || "", // Optional
      })),
    };
  }

  async getPopularDestinations() {
    // Without this, a disconnected Mongo buffers the query for 10s before
    // rejecting, stalling the dropdown's empty state on every page load.
    if (!isMongoReady()) {
      console.warn("[Destinations] MongoDB not connected — returning no popular destinations.");
      return { status: true, body: [] };
    }

    // Preferred source: the cities we actually hold inventory in. The curated
    // list below stays as the fallback for a cold or empty catalogue.
    const topCities = await this.getTopCities(
      process.env.HOME_COUNTRY_NAME || "India",
      8,
    );
    if (topCities.length) {
      return {
        status: true,
        body: topCities.map((c) => ({
          id: `CITY:${c.name}`,
          name: c.name,
          type: "popular",
          city: c.name,
          country: c.country,
          hotelCount: c.hotelCount,
        })),
      };
    }

    try {
      const popularNames = [
        "Jaipur",
        "Delhi",
        "Goa",
        "Kerala",
        "Hyderabad",
        "Mumbai",
        "Chennai",
      ];

      // Use a case-insensitive regex to match these specific destinations
      // We'll also try to fetch the shortest `destCode` for each to avoid redundant variations
      const regexPatterns = popularNames.map(
        (name) => new RegExp(`^${name}`, "i"),
      );

      const destinations = await RGDestinationModel.find({
        destName: { $in: regexPatterns },
      }).lean();

      // Deduplicate and prioritize exact matches or shortest names
      const uniqueDestinationsMap = new Map();

      for (const dest of destinations) {
        // Find which popular name it matches
        const matchedName = popularNames.find((name) =>
          dest.destName.toLowerCase().startsWith(name.toLowerCase()),
        );

        if (matchedName) {
          // If we already have one, keep the one with the shorter name (usually the primary one)
          if (
            !uniqueDestinationsMap.has(matchedName) ||
            dest.destName.length <
              uniqueDestinationsMap.get(matchedName).destName.length
          ) {
            uniqueDestinationsMap.set(matchedName, dest);
          }
        }
      }

      // If some are missing (e.g. 'New Delhi' instead of 'Delhi'), we can do a fallback
      for (const name of popularNames) {
        if (!uniqueDestinationsMap.has(name)) {
          const fallbackMatch = await RGDestinationModel.findOne({
            destName: new RegExp(name, "i"), // broader match
          }).lean();
          if (fallbackMatch) uniqueDestinationsMap.set(name, fallbackMatch);
        }
      }

      const finalDestinations = Array.from(uniqueDestinationsMap.values());

      return {
        status: true,
        body: finalDestinations.map((dest) => {
          const rawName = dest.destName.split(",")[0];
          const cleanName = rawName.replace(/\s+india$/i, "").trim();
          return {
            id: dest.destCode,
            name: cleanName,
            type: "popular",
            city: cleanName,
          };
        }),
      };
    } catch (error: any) {
      console.error(
        "❌ [DestinationsService] Failed to fetch popular destinations:",
        error.message,
      );
      return {
        status: true,
        body: [], // Return empty list on failure instead of 500
      };
    }
  }
}

export const destinationsService = new DestinationsService();
