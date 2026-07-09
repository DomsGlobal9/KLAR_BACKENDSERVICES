import { searchRG } from "../adapters/rateGainAdapter";
import { searchTJ } from "../adapters/tripJackAdapter";
import { resolveCityToCoords, resolveGeoCenter } from "./destinationResolver";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { getMarkupRules } from "../utils/auth";
import { calculateNights, calculateEnrichedPricing } from "../utils/pricing.util";

export class HotelsService {
  /**
   * Unified Search Entry Point
   * Senior OTA Strategy: Concurrently fetch, partial return on slow providers,
   * and high-efficiency deduplication.
   */
  async searchHotels(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C" = "B2C",
    token?: string | null,
  ) {
    const totalStartTime = Date.now();
    const markupRules = token ? await getMarkupRules(token) : [];
    const nights = calculateNights(searchPayload.checkin, searchPayload.checkout);
    const mode = process.env.HOTEL_PROVIDER_MODE || "UNIFIED";
    console.log(
      `[DEBUG] searchHotels triggered for "${searchPayload.destination}". Mode: ${mode}, ClientType: ${clientType}`,
    );

    const isDirectTJ =
      searchPayload.destination.startsWith("TJ:") ||
      /^\d{8,15}$/.test(searchPayload.destination.trim());
    const isDirectRG = searchPayload.destination.startsWith("RG:");
    const isDirectSearch = isDirectTJ || isDirectRG;

    if (isDirectSearch) {
      console.log(
        `[DEBUG] Direct hotel search detected for "${searchPayload.destination}".`,
      );
    }

    // 1. Resolve Location (Once) - Skip if direct search
    let geoCenter = null;
    if (!isDirectSearch) {
      if (searchPayload.destinationCode && searchPayload.destinationCode.startsWith("GEO:")) {
        const coords = searchPayload.destinationCode.replace("GEO:", "").split(",");
        if (coords.length === 2) {
          const lat = parseFloat(coords[0]);
          const lng = parseFloat(coords[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            // Resolve geoCenter dynamically (snaps to official city center if close, e.g. Dubai)
            geoCenter = await resolveGeoCenter(lat, lng);
            console.log(`[GEO] Instant resolution from GEO token: Lat=${geoCenter.lat}, Lng=${geoCenter.lng}, Radius=${geoCenter.radiusKm}km (resolved)`);
          }
        }
      }
      if (!geoCenter) {
        geoCenter = await resolveCityToCoords(searchPayload.destination);
      }
    }
    searchPayload._geoCenter = geoCenter;

    if (geoCenter) {
      console.log(
        `[GEO] Destination resolved for "${searchPayload.destination}": Lat=${geoCenter.lat}, Lng=${geoCenter.lng}, Radius=${geoCenter.radiusKm.toFixed(2)}km`,
      );
    } else if (!isDirectSearch) {
      console.log(
        `[GEO] No geo center resolved for "${searchPayload.destination}"`,
      );
    }

    const finalResults: UnifiedHotel[] = [];
    let rgTotal = 0;
    let tjTotal = 0;
    let rgCount = 0;
    let tjCount = 0;

    // 2. Define Providers based on Mode
    const providers: { name: string; task: Promise<void> }[] = [];
    const requestedProviders = searchPayload.providers;

    if (
      (mode === "UNIFIED" || mode === "RG_ONLY") &&
      (!isDirectSearch || isDirectRG)
    ) {
      const isRgAllowed =
        !requestedProviders ||
        requestedProviders.length === 0 ||
        requestedProviders.includes("RG");
      if (isRgAllowed) {
        providers.push({
          name: "RG",
          task: searchRG(searchPayload, clientType)
            .then((res) => {
              rgCount = res.hotels.length;
              rgTotal = res.total;
              finalResults.push(...res.hotels);
              console.log(
                `[OK] RG finished in ${Date.now() - totalStartTime}ms (${rgCount} hotels)`,
              );
            })
            .catch((err) => {
              console.error(`[ERR] RG failed: ${err.message}`);
            }),
        });
      } else {
        console.log(
          `[SKIP] RG skipped because providers filter is active and does not include RG`,
        );
      }
    }

    if (
      (mode === "UNIFIED" || mode === "TJ_ONLY") &&
      (!isDirectSearch || isDirectTJ)
    ) {
      const isTjAllowed =
        !requestedProviders ||
        requestedProviders.length === 0 ||
        requestedProviders.includes("TJ");
      if (isTjAllowed) {
        providers.push({
          name: "TJ",
          task: searchTJ(searchPayload)
            .then((res) => {
              tjCount = res.hotels.length;
              tjTotal = res.total;
              finalResults.push(...res.hotels);
              console.log(
                `[OK] TJ finished in ${Date.now() - totalStartTime}ms (${tjCount} hotels)`,
              );
            })
            .catch((err) => {
              console.error(`[ERR] TJ failed: ${err.message}`);
            }),
        });
      } else {
        console.log(
          `[SKIP] TJ skipped because providers filter is active and does not include TJ`,
        );
      }
    }

    // 3. Orchestration: High-Performance Concurrent Collection
    // Wait for all providers, but cap at 15 seconds for partial-result return (MMT-style).
    // RG typically responds in 2-5s, TJ in 4-6s. 15s covers almost all cases and provides a stable UI.
    const allTasks = providers.map((p) => p.task);
    const PARTIAL_RETURN_TIMEOUT_MS = 15000;

    await Promise.race([
      Promise.allSettled(allTasks),
      new Promise<void>((resolve) =>
        setTimeout(resolve, PARTIAL_RETURN_TIMEOUT_MS),
      ),
    ]);

    // If any provider is still pending after timeout, we return whatever arrived.
    // (The pending promises continue in background but we don't await them further.)

    // 4. Deduplication Logic (MMT-style efficient dedup)
    const totalReceivedCount = finalResults.length;
    const { items: deduplicatedResults, meta: dedupMeta } =
      deduplicateHotels(finalResults);

    // Calculate reported total (rough estimate)
    // Senior Dev: If we are on Page 1 and have fewer than 10 results but provider says more,
    // we should still respect the provider's total for pagination to work,
    // but only if the provider actually returned something.
    const totalToUI = Math.max(rgTotal + tjTotal, deduplicatedResults.length);

    const totalDuration = Date.now() - totalStartTime;

    const tjLog =
      (mode === "UNIFIED" || mode === "TJ_ONLY") &&
      (!isDirectSearch || isDirectTJ)
        ? `${tjCount} (Total: ${tjTotal})`
        : "[SKIPPED]";
    const rgLog =
      (mode === "UNIFIED" || mode === "RG_ONLY") &&
      (!isDirectSearch || isDirectRG)
        ? `${rgCount} (Total: ${rgTotal})`
        : "[SKIPPED]";

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 FINAL SEARCH SUMMARY (Senior OTA Logic)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TJ Status: ${tjLog}
RG Status: ${rgLog}
----------------------------------------------------
Total Combined Unique:     ${deduplicatedResults.length}
Items Merged (Cheaper Wins): ${dedupMeta.duplicatedCount}
Search Duration:           ${totalDuration}ms
----------------------------------------------------
Reported Total to UI:      ${totalToUI}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    let finalOutputHotels = deduplicatedResults;
    if (geoCenter) {
      const allowedRadiusKm = geoCenter.radiusKm || 20;

      finalOutputHotels = deduplicatedResults.filter((hotel) => {
        const lat = Number(hotel.latitude);
        const lng = Number(hotel.longitude);
        if (!lat || !lng) return true; // Keep if coordinates are missing/invalid to avoid false positives

        const dist = getDistanceKm(geoCenter.lat, geoCenter.lng, lat, lng);
        return dist <= allowedRadiusKm;
      });
      console.log(
        `[GEO] Dynamic geofence: Filtered hotels using ${allowedRadiusKm.toFixed(2)}km radius around [${geoCenter.lat}, ${geoCenter.lng}]. Kept ${finalOutputHotels.length}/${deduplicatedResults.length} hotels.`,
      );
    }

    // 1. Compute facets on the unfiltered/geofenced list
    const facets = computeFacets(finalOutputHotels, markupRules, nights);

    // 2. Apply filters (if provided)
    let filteredResults = finalOutputHotels;
    const filters = searchPayload.filters;
    if (filters) {
      // Text search
      if (filters.searchText && filters.searchText.trim()) {
        const q = filters.searchText.toLowerCase().trim();
        filteredResults = filteredResults.filter((h) => {
          const name = (h.name || "").toLowerCase();
          const city = (h.city || "").toLowerCase();
          const address = (h.address || "").toLowerCase();
          return name.includes(q) || city.includes(q) || address.includes(q);
        });
      }

      // Star ratings
      if (filters.starRatings && filters.starRatings.length > 0) {
        filteredResults = filteredResults.filter((h) =>
          filters.starRatings!.includes(Math.round(h.starRating || 0))
        );
      }

      // Price range (against marked-up price)
      if (filters.priceRanges && filters.priceRanges.length > 0) {
        filteredResults = filteredResults.filter((h) => {
          const enriched = calculateEnrichedPricing(
            {
              basePrice: h.basePrice ?? h.price,
              totalPrice: h.price,
              taxes: h.taxAmount ?? 0,
              mf: 0,
              mft: 0,
              currency: h.currency,
            },
            markupRules,
            nights
          );
          const price = enriched.finalTotalPrice;
          return filters.priceRanges!.some(([minP, maxP]) => price >= minP && price <= maxP);
        });
      } else if (filters.priceRange && filters.priceRange[1] > 0) {
        const [minP, maxP] = filters.priceRange;
        filteredResults = filteredResults.filter((h) => {
          const enriched = calculateEnrichedPricing(
            {
              basePrice: h.basePrice ?? h.price,
              totalPrice: h.price,
              taxes: h.taxAmount ?? 0,
              mf: 0,
              mft: 0,
              currency: h.currency,
            },
            markupRules,
            nights
          );
          const price = enriched.finalTotalPrice;
          return price >= minP && price <= maxP;
        });
      }

      // Meal types
      if (filters.mealTypes && filters.mealTypes.length > 0) {
        filteredResults = filteredResults.filter((h) => {
          const hMeals = getMealTypes(h);
          return hMeals.some((m) => filters.mealTypes!.includes(m));
        });
      }

      // Property types
      if (filters.propertyTypes && filters.propertyTypes.length > 0) {
        filteredResults = filteredResults.filter((h) => {
          const label = getPropertyTypeLabel(h);
          return filters.propertyTypes!.includes(label);
        });
      }

      // Amenities (ALL must match)
      if (filters.amenities && filters.amenities.length > 0) {
        filteredResults = filteredResults.filter((h) => {
          const hAmenities = (h.amenities || []).map((a: string) => a.toLowerCase());
          return filters.amenities!.every((a) =>
            hAmenities.some((ha) => ha.includes(a.toLowerCase()))
          );
        });
      }

      // Show only alternative deals
      if (filters.showOnlyAltDeals) {
        filteredResults = filteredResults.filter((h) => !!h.altDeal);
      }

      // Providers
      if (filters.providers && filters.providers.length > 0) {
        filteredResults = filteredResults.filter((h) =>
          h.source && filters.providers!.includes(h.source)
        );
      }

      // User ratings
      if (filters.userRatings && filters.userRatings.length > 0) {
        const minRating = Math.min(...filters.userRatings);
        filteredResults = filteredResults.filter((h) => {
          const rating = h.starRating || 0;
          return rating >= minRating;
        });
      }

      // Selected locations
      if (filters.selectedLocations && filters.selectedLocations.length > 0) {
        filteredResults = filteredResults.filter((h) => {
          const hotelCity = (h.city || "").trim();
          const hotelAddr = (h.address || "").split(",")[0]?.trim() || "";
          return filters.selectedLocations!.some(
            (loc) => hotelCity === loc || hotelAddr === loc
          );
        });
      }
    }

    // 3. Apply sorting (if provided)
    const sortBy = searchPayload.sortBy;
    if (sortBy) {
      filteredResults.sort((a, b) => {
        const enrichedA = calculateEnrichedPricing(
          {
            basePrice: a.basePrice ?? a.price,
            totalPrice: a.price,
            taxes: a.taxAmount ?? 0,
            mf: 0,
            mft: 0,
            currency: a.currency,
          },
          markupRules,
          nights
        );
        const priceA = enrichedA.finalTotalPrice;

        const enrichedB = calculateEnrichedPricing(
          {
            basePrice: b.basePrice ?? b.price,
            totalPrice: b.price,
            taxes: b.taxAmount ?? 0,
            mf: 0,
            mft: 0,
            currency: b.currency,
          },
          markupRules,
          nights
        );
        const priceB = enrichedB.finalTotalPrice;

        if (sortBy === "price_asc") return priceA - priceB;
        if (sortBy === "price_desc") return priceB - priceA;
        if (sortBy === "rating_desc") {
          const rd = (b.starRating || 0) - (a.starRating || 0);
          return rd !== 0 ? rd : priceA - priceB;
        }
        if (sortBy === "price_rating") {
          const scoreA = priceA * 0.5 + (5 - (a.starRating || 0)) * 10000 * 0.5;
          const scoreB = priceB * 0.5 + (5 - (b.starRating || 0)) * 10000 * 0.5;
          return scoreA - scoreB;
        }
        return 0;
      });
    }

    // 4. Optimize payload: Strip rawPayload, ensure correlationId is propagated
    const optimizedResults = filteredResults.map((hotel) => {
      const { rawPayload, ...rest } = hotel;
      return {
        ...rest,
        correlationId: (rawPayload as any)?._correlationId || hotel.correlationId || "",
      };
    });

    return {
      results: optimizedResults,
      body: optimizedResults, // Fallback for some frontend components
      hotels: optimizedResults,
      total: Math.max(rgTotal + tjTotal, filteredResults.length),
      facets,
    };
  }

  async getHotelSuggestions(query: string) {
    const { HotelModel } = require("../models/Hotel.model");
    const { City } = require("country-state-city");

    if (!query || query.trim().length < 2) {
      return [];
    }

    // Normalize common spelling mistakes like "anaya" instead of "ananya"
    let normalizedQuery = query.trim();
    if (/anaya/i.test(normalizedQuery)) {
      normalizedQuery = normalizedQuery.replace(/anaya/gi, "ananya");
    }

    const qLower = normalizedQuery.toLowerCase();
    const escapedQuery = normalizedQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const prefixRegex = new RegExp("^" + escapedQuery, "i");
    const containsRegex = new RegExp(escapedQuery, "i");

    // 1. Fetch cities from local country-state-city package
    const allCities = City.getAllCities();
    const qWords = qLower.split(/\s+/).filter(Boolean);
    const cityMatches: Array<{ city: any; score: number }> = [];

    for (const city of allCities) {
      const cityNameLower = city.name.toLowerCase();
      let matchesAll = true;
      for (const word of qWords) {
        if (!cityNameLower.includes(word)) {
          matchesAll = false;
          break;
        }
      }
      
      if (matchesAll) {
        const score = cityNameLower.startsWith(qLower) ? 1 : (cityNameLower.includes(qLower) ? 2 : 3);
        cityMatches.push({ city, score });
      }
    }

    // Fuzzy matching fallback if exact matches are lacking
    if (cityMatches.length < 3) {
      const { fuzzyFindCities } = require("../utils/fuzzy");
      const fuzzyResults = fuzzyFindCities(normalizedQuery, allCities);
      
      for (const fuzzyCity of fuzzyResults) {
        const alreadyMatched = cityMatches.some(
          (m) =>
            m.city.name.toLowerCase() === fuzzyCity.name.toLowerCase() &&
            m.city.countryCode === fuzzyCity.countryCode
        );
        if (!alreadyMatched) {
          cityMatches.push({ city: fuzzyCity, score: 4 });
        }
      }
    }

    // Sort by:
    // 1. Country priority (India 'IN' first)
    // 2. Prefix/Fuzzy match score (starts-with/exact match first, fuzzy last)
    // 3. Shorter name length first (more precise matches)
    cityMatches.sort((a, b) => {
      const aIsIN = a.city.countryCode === "IN" ? 1 : 0;
      const bIsIN = b.city.countryCode === "IN" ? 1 : 0;
      if (aIsIN !== bIsIN) return bIsIN - aIsIN; // India first
      if (a.score !== b.score) return a.score - b.score;
      return a.city.name.length - b.city.name.length;
    });

    const { State, Country } = require("country-state-city");

    const mappedCities = cityMatches.slice(0, 10).map((m) => {
      const c = m.city;
      const countryObj = Country.getCountryByCode(c.countryCode);
      const countryName = countryObj ? countryObj.name : c.countryCode;

      const stateObj = State.getStateByCodeAndCountry(c.stateCode, c.countryCode);
      const stateName = stateObj ? stateObj.name : c.stateCode;

      const statePart = stateName ? `${stateName}, ` : "";
      const label = `${c.name}, ${statePart}${countryName}`;
      const geoId = `GEO:${c.latitude},${c.longitude}`;
      return {
        id: geoId,
        destCode: geoId,
        destName: label,
        label: label,
        type: "city",
        source: "GEO",
      };
    });

    // 2. Fetch hotels from database
    let hotels = await HotelModel.find({
      $or: [{ name: prefixRegex }, { cityName: prefixRegex }],
    })
      .limit(15)
      .lean();

    if (hotels.length < 8) {
      const extraHotels = await HotelModel.find({
        $or: [{ name: containsRegex }, { cityName: containsRegex }],
        _id: { $nin: hotels.map((h: any) => h._id) },
      })
        .limit(15 - hotels.length)
        .lean();
      hotels = [...hotels, ...extraHotels];
    }

    const suggestions = [
      ...mappedCities,
      ...hotels.map((h: any) => {
        const hotelId = h.tjHotelId.startsWith("TJ:")
          ? h.tjHotelId
          : `TJ:${h.tjHotelId}`;
        return {
          id: hotelId,
          hotelId: hotelId,
          label: `${h.name}, ${h.cityName}`,
          name: h.name,
          type: "hotel",
          source: "TJ",
          city: h.cityName,
        };
      }),
    ];

    // Deduplicate suggestions by name
    const uniqueSuggestions = Array.from(
      new Map(
        suggestions.map((item) => {
          const dedupeKey = item.label.toLowerCase().trim();
          return [dedupeKey, item];
        }),
      ).values(),
    );

    return uniqueSuggestions;
  }
}

export const hotelsService = new HotelsService();

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

const PROPERTY_TYPE_KEYWORDS: Record<string, string> = {
  resort: "Resort",
  hotel: "Hotel",
  apartment: "Apartment",
  villa: "Villa",
  hostel: "Hostel",
  guesthouse: "Guesthouse",
  "b&b": "B&B",
  motel: "Motel",
  lodge: "Lodge",
  camp: "Camp",
  tent: "Tent",
  cabin: "Cabin",
  cottage: "Cottage",
  palace: "Hotel",
};

function getPropertyTypeLabel(hotel: any): string {
  const explicit = hotel.accTypeDesc || hotel.accMultiDesc;
  if (explicit && typeof explicit === "string" && explicit.trim().length > 2) {
    const clean = explicit.trim();
    for (const [key, label] of Object.entries(PROPERTY_TYPE_KEYWORDS)) {
      if (clean.toLowerCase().includes(key)) return label;
    }
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  const specificSources = [
    hotel.accTypeDesc,
    hotel.accMultiDesc,
    hotel.name || "",
    ...(hotel.amenities || []),
  ];

  const specificEntries = Object.entries(PROPERTY_TYPE_KEYWORDS).filter(
    ([key]) => key !== "hotel",
  );

  for (const src of specificSources) {
    const text = Array.isArray(src) ? src.join(" ") : String(src || "");
    const lower = text.toLowerCase();
    for (const [key, label] of specificEntries) {
      if (lower.includes(key)) return label;
    }
  }

  if (hotel.hotelSegment && typeof hotel.hotelSegment === "string") {
    const cleanSeg = hotel.hotelSegment.trim();
    if (cleanSeg.toLowerCase() !== "hotel") {
      for (const [key, label] of Object.entries(PROPERTY_TYPE_KEYWORDS)) {
        if (cleanSeg.toLowerCase().includes(key)) return label;
      }
      return cleanSeg;
    }
  }

  return "Hotel";
}

function getMealTypes(hotel: any): string[] {
  const types = new Set<string>();
  const boardSources = [
    hotel.mealBasis,
    hotel.boardName,
    hotel.boardCode,
    ...(hotel.hotelBoards || []),
  ].filter(Boolean);

  boardSources.forEach((b) => {
    const titleCase = b
      .trim()
      .split(" ")
      .map(
        (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )
      .join(" ");
    types.add(titleCase);
  });
  return Array.from(types);
}

function computeFacets(hotels: any[], markupRules: any[], nights: number) {
  const starRatingCounts: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  const propertyTypeCounts: Record<string, number> = {};
  const mealTypeCounts: Record<string, number> = {};
  const amenityCounts: Record<string, number> = {};
  const providerCounts: Record<string, number> = { TJ: 0, RG: 0 };
  const locationCounts: Record<string, number> = {};

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  hotels.forEach((hotel) => {
    // 1. Star Rating
    const star = Math.round(Number(hotel.starRating || hotel.rating || 0));
    if (star >= 1 && star <= 5) {
      starRatingCounts[star] = (starRatingCounts[star] || 0) + 1;
    }

    // 2. Property Type
    const propType = getPropertyTypeLabel(hotel);
    if (propType) {
      propertyTypeCounts[propType] = (propertyTypeCounts[propType] || 0) + 1;
    }

    // 3. Meal Type
    const meals = getMealTypes(hotel);
    meals.forEach((m) => {
      mealTypeCounts[m] = (mealTypeCounts[m] || 0) + 1;
    });

    // 4. Amenities
    const amenities = hotel.amenities || [];
    amenities.forEach((a: string) => {
      const normalized = a
        .trim()
        .split(/\s+/)
        .map(
          (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join(" ");
      if (normalized) {
        amenityCounts[normalized] = (amenityCounts[normalized] || 0) + 1;
      }
    });

    // 5. Providers
    if (hotel.source === "TJ" || hotel.source === "RG") {
      providerCounts[hotel.source] = (providerCounts[hotel.source] || 0) + 1;
    }

    // 6. Prices
    const enriched = calculateEnrichedPricing(
      {
        basePrice: hotel.basePrice ?? hotel.price,
        totalPrice: hotel.price,
        taxes: hotel.taxAmount ?? 0,
        mf: 0,
        mft: 0,
        currency: hotel.currency,
      },
      markupRules,
      nights,
    );
    const markedUpPrice = enriched.finalTotalPrice;
    if (markedUpPrice < minPrice) minPrice = markedUpPrice;
    if (markedUpPrice > maxPrice) maxPrice = markedUpPrice;

    // 7. Top Locations
    if (hotel.address) {
      const addressParts = hotel.address
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (addressParts.length > 1) {
        const locality = addressParts[addressParts.length - 2];
        if (locality && locality.length > 2 && !/\d/.test(locality)) {
          const normalizedLoc = locality
            .split(/\s+/)
            .map(
              (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
            )
            .join(" ");
          locationCounts[normalizedLoc] =
            (locationCounts[normalizedLoc] || 0) + 1;
        }
      }
    }
  });

  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    starRatingCounts,
    propertyTypeCounts,
    mealTypeCounts,
    amenityCounts,
    providerCounts,
    minPrice: minPrice === Infinity ? 0 : minPrice,
    maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
    topLocations,
  };
}
