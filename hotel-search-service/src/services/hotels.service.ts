import { supplierRegistry } from "../suppliers";
import { resolveCityToCoords, resolveGeoCenter } from "./destinationResolver";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { getMarkupRules } from "../utils/auth";
import { calculateNights, calculateEnrichedPricing, round2 } from "../utils/pricing.util";
import { getSuggestions } from "./suggestions.service";
import {
  accumulateFacets,
  buildFacetKey,
  emptyFacets,
  getMealTypes,
  getPropertyTypeLabel,
} from "./facets.service";

// Short-TTL in-memory cache for identical anonymous (token-less) searches, so
// repeated B2C searches for the same destination/dates don't re-hit the paid
// supplier APIs on every keystroke/refresh. B2B (token) searches are never
// cached because pricing depends on the agent's markup rules.
const searchCache = new Map<string, { at: number; data: any }>();
const SEARCH_CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 60_000);
const SEARCH_CACHE_MAX_ENTRIES = 500;

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

    // Guard against clearly-invalid input BEFORE hitting suppliers: avoids a wasted
    // supplier round-trip on bad dates and prevents a crash in the adapters' rooms.map()
    // when `rooms` is missing/empty. Valid searches are unaffected.
    const ci = new Date(searchPayload.checkin);
    const co = new Date(searchPayload.checkout);
    const roomsOk =
      Array.isArray(searchPayload.rooms) &&
      searchPayload.rooms.length > 0 &&
      searchPayload.rooms.every((r) => Number(r.adults) >= 1);
    if (
      !searchPayload.checkin ||
      !searchPayload.checkout ||
      isNaN(ci.getTime()) ||
      isNaN(co.getTime()) ||
      ci.getTime() >= co.getTime() ||
      !roomsOk
    ) {
      console.warn(
        `[Search] Rejected invalid input — checkin=${searchPayload.checkin}, checkout=${searchPayload.checkout}, rooms=${JSON.stringify(searchPayload.rooms)}. Returning empty result set.`,
      );
      return {
        results: [],
        body: [],
        hotels: [],
        total: 0,
        hasMore: false,
        inventoryCount: 0,
        facets: emptyFacets(),
      };
    }

    // Serve identical anonymous searches from the short-TTL cache to spare the
    // paid supplier APIs. Keyed on the whole request (minus the geo center we
    // resolve below). B2B (token) requests are never cached.
    const cacheable = !token;
    const cacheKey = cacheable
      ? JSON.stringify({ ...searchPayload, _geoCenter: undefined, __ct: clientType })
      : "";
    if (cacheable) {
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
        console.log(`[Search] cache hit for "${searchPayload.destination}"`);
        return cached.data;
      }
    }

    const isDirectSearch = supplierRegistry.isDirectSearch(searchPayload.destination);

    if (isDirectSearch) {
      console.log(
        `[DEBUG] Direct hotel search detected for "${searchPayload.destination}".`,
      );
    }

    // 1. Resolve Location (Once) - Skip if direct search
    let geoCenter = null;
    if (!isDirectSearch) {
      const hasDestinationText =
        !!searchPayload.destination && searchPayload.destination.trim().length > 2;

      // Text resolution is authoritative: OpenCage + GeoCache place a city at its
      // real centre with a radius covering its true extent. Prefer it whenever we
      // have a name to resolve, and only fall back to a GEO token when we don't.
      if (hasDestinationText) {
        geoCenter = await resolveCityToCoords(searchPayload.destination);
      }

      if (searchPayload.destinationCode?.startsWith("GEO:")) {
        const [latRaw, lngRaw] = searchPayload.destinationCode.slice(4).split(",");
        const lat = parseFloat(latRaw);
        const lng = parseFloat(lngRaw);

        if (!isNaN(lat) && !isNaN(lng)) {
          if (geoCenter) {
            // Nothing generates GEO tokens any more. The ones that still arrive come
            // from cached "recent searches" and bookmarked ?destCode= links, and were
            // built from country-state-city coordinates that can sit tens of km off
            // (Mysuru: 27km out, snapping to a 5km rural radius → zero hotels).
            // The name resolved, so the token has nothing to add.
            const drift = getDistanceKm(lat, lng, geoCenter.lat, geoCenter.lng);
            console.warn(
              `[GEO] Ignoring legacy GEO token [${lat},${lng}] (${drift.toFixed(0)}km from ` +
                `text-resolved "${searchPayload.destination}") — text resolution wins.`,
            );
          } else {
            // No usable destination name — the token is all we have.
            geoCenter = await resolveGeoCenter(lat, lng);
            console.log(
              `[GEO] Resolved from GEO token: Lat=${geoCenter.lat}, Lng=${geoCenter.lng}, Radius=${geoCenter.radiusKm}km`,
            );
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
    const providerStats: Record<string, { count: number; total: number; hasMore: boolean }> = {};

    // 2. Fan out to every supplier enabled for this mode/destination/providers-filter.
    //    Adding a new supplier = register() it in suppliers/index.ts; nothing below
    //    this line ever needs to change.
    const requestedProviders = searchPayload.providers;
    const eligibleSuppliers = supplierRegistry.getModeAndDirectEligible(
      mode,
      searchPayload.destination,
    );
    const enabledSuppliers = supplierRegistry.getEnabled({
      mode,
      destination: searchPayload.destination,
      requestedCodes: requestedProviders,
    });

    if (requestedProviders && requestedProviders.length > 0) {
      eligibleSuppliers
        .filter((s) => !requestedProviders.includes(s.code))
        .forEach((s) =>
          console.log(
            `[SKIP] ${s.code} skipped because providers filter is active and does not include ${s.code}`,
          ),
        );
    }

    // One AbortController for this search. Its signal is threaded into every
    // supplier's underlying axios call; once we decide to return (all settled or
    // the partial-return window elapsed) we abort it, so a slow supplier's HTTP
    // request is actively cancelled instead of orphaned until its own timeout.
    const abortController = new AbortController();
    searchPayload._abortSignal = abortController.signal;

    const allTasks = enabledSuppliers.map((supplier) =>
      supplier
        .search(searchPayload, clientType)
        .then((res) => {
          providerStats[supplier.code] = {
            count: res.hotels.length,
            total: res.total,
            hasMore: res.hasMore,
          };
          finalResults.push(...res.hotels);
          console.log(
            `[OK] ${supplier.code} finished in ${Date.now() - totalStartTime}ms (${res.hotels.length} hotels)`,
          );
        })
        .catch((err) => {
          console.error(`[ERR] ${supplier.code} failed: ${err.message}`);
        }),
    );

    // 3. Orchestration: High-Performance Concurrent Collection
    // Wait for all providers, but cap at 15 seconds for partial-result return (MMT-style).
    // RG typically responds in 2-5s, TJ in 4-6s. 15s covers almost all cases and provides a stable UI.
    const PARTIAL_RETURN_TIMEOUT_MS = 15000;

    let partialTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled(allTasks),
      new Promise<void>((resolve) => {
        partialTimer = setTimeout(resolve, PARTIAL_RETURN_TIMEOUT_MS);
      }),
    ]);
    // Clear the timer (harmless if it already fired) and actively cancel any
    // supplier request still in flight. Already-settled requests are unaffected;
    // the losing supplier's socket is released now instead of lingering.
    if (partialTimer) clearTimeout(partialTimer);
    abortController.abort();

    // 4. Deduplication Logic (MMT-style efficient dedup)
    const totalReceivedCount = finalResults.length;
    const { items: deduplicatedResults, meta: dedupMeta } =
      deduplicateHotels(finalResults);

    // Whether any supplier still has pages left. This — not a summed total — is
    // what tells the client to keep loading.
    const hasMore = Object.values(providerStats).some((s) => s.hasMore);

    // How many properties we know of in this destination — the "6,179 properties
    // in Goa" figure, not the subset bookable on these dates.
    //
    // Deliberately the largest supplier's count, never the sum: the same hotel is
    // listed by TripJack and RateGain both (which is why deduplicateHotels exists),
    // so adding 6,179 + 384 counts an unknown overlap twice and yields a number
    // that is not a count of anything. Zero when the destination came back empty,
    // so a search with no results can never claim to have properties.
    const providerTotals = Object.values(providerStats).map((s) => s.total);
    const inventoryCount = deduplicatedResults.length
      ? Math.max(...providerTotals, deduplicatedResults.length)
      : 0;

    // Sum kept purely for the diagnostic log line below.
    const sumProviderTotals = providerTotals.reduce((sum, t) => sum + t, 0);
    const totalToUI = Math.max(sumProviderTotals, deduplicatedResults.length);

    const totalDuration = Date.now() - totalStartTime;

    // Per-supplier status lines — automatically includes any future registered supplier.
    const statusLines = supplierRegistry
      .all()
      .map((s) => {
        const wasQueried = enabledSuppliers.includes(s);
        const stat = providerStats[s.code];
        const line = wasQueried && stat ? `${stat.count} (Total: ${stat.total})` : "[SKIPPED]";
        return `${s.code} Status: ${line}`;
      })
      .join("\n");

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 FINAL SEARCH SUMMARY (Senior OTA Logic)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${statusLines}
----------------------------------------------------
Total Combined Unique:     ${deduplicatedResults.length}
Items Merged (Cheaper Wins): ${dedupMeta.duplicatedCount}
Search Duration:           ${totalDuration}ms
----------------------------------------------------
Summed provider totals:    ${totalToUI} (double-counts supplier overlap — never shown)
Destination inventory:     ${inventoryCount} (properties known in this area)
Has more pages:            ${hasMore}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    let finalOutputHotels = deduplicatedResults;
    if (geoCenter) {
      // Exact api-derived radius (same as TJ $near and RG Geofilter), no rounding.
      const allowedRadiusKm = geoCenter.radiusKm || 20;

      finalOutputHotels = deduplicatedResults.filter((hotel) => {
        const lat = Number(hotel.latitude);
        const lng = Number(hotel.longitude);
        // Keep if coordinates are genuinely missing/invalid (NaN) or the [0,0]
        // "no-coords" sentinel — to avoid false negatives. A real hotel on the
        // equator (lat 0) or prime meridian (lng 0) is still distance-checked.
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          return true;
        }

        const dist = getDistanceKm(geoCenter.lat, geoCenter.lng, lat, lng);
        return dist <= allowedRadiusKm;
      });
      console.log(
        `[GEO] Dynamic geofence: Filtered hotels using ${allowedRadiusKm.toFixed(2)}km radius around [${geoCenter.lat}, ${geoCenter.lng}]. Kept ${finalOutputHotels.length}/${deduplicatedResults.length} hotels.`,
      );
    }

    // 1. Fold this page into the search's running facets and return the
    //    cumulative counts. Built from the unfiltered/geofenced list so that
    //    applying a filter never zeroes out the options the user didn't pick.
    const facetKey = buildFacetKey(searchPayload, clientType, markupRules);
    const facets = accumulateFacets(
      facetKey,
      finalOutputHotels,
      markupRules,
      nights,
    );

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

    // 4. Bake markup into the returned price (single source of truth — same as the
    //    detail/products path). Search now returns FINAL prices; the frontend renders
    //    them verbatim (no client-side markup). B2C / no-rule => markup 0.
    const optimizedResults = filteredResults.map((hotel) => {
      const { rawPayload, ...rest } = hotel;
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
      // The cross-provider "compare" price must include markup too, otherwise the
      // alternative-deal price shown next to the (marked-up) main price is unfair/wrong.
      const altDeal = rest.altDeal
        ? {
            ...rest.altDeal,
            price: round2(
              calculateEnrichedPricing(
                {
                  basePrice: rest.altDeal.price,
                  totalPrice: rest.altDeal.price,
                  taxes: 0,
                  mf: 0,
                  mft: 0,
                  currency: hotel.currency,
                },
                markupRules,
                nights,
              ).finalTotalPrice,
            ),
          }
        : rest.altDeal;

      return {
        ...rest,
        // price now INCLUDES markup; basePrice stays the net room cost
        price: round2(enriched.finalTotalPrice),
        altDeal,
        pricing: {
          ...(rest.pricing || {}),
          markupAmount: round2(enriched.markupAmount),
          perNightPrice: round2(enriched.perNightPrice),
          finalTotalPrice: round2(enriched.finalTotalPrice),
          supplierTotalPrice: round2(enriched.supplierTotalPrice),
        },
        correlationId: (rawPayload as any)?._correlationId || hotel.correlationId || "",
      };
    });

    const response = {
      results: optimizedResults,
      body: optimizedResults, // Fallback for some frontend components
      hotels: optimizedResults,
      // Hotels on this page. The client accumulates across pages and uses
      // `hasMore` to decide whether to ask for another one. Reporting a summed
      // provider total here made the UI claim "1 Property" for a search that
      // returned none, and made infinite scroll fetch forever.
      total: optimizedResults.length,
      hasMore,
      // Properties we hold for this destination, for "Showing 40 of 6,179".
      // Display only — never drives paging.
      inventoryCount,
      facets,
    };

    if (cacheable) {
      // Bound the cache: drop the oldest entry when full (Map preserves insertion order).
      if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey !== undefined) searchCache.delete(oldestKey);
      }
      searchCache.set(cacheKey, { at: Date.now(), data: response });
    }

    return response;
  }

  /**
   * Destination + hotel autocomplete. The implementation lives in
   * suggestions.service so the static city index and the LRU cache can be
   * shared and warmed independently of this class.
   */
  async getHotelSuggestions(query: string) {
    return getSuggestions(query);
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
