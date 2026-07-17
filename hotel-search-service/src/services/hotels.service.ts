import crypto from "crypto";
import { supplierRegistry } from "../suppliers";
import { resolveCityToCoords, resolveGeoCenter } from "./destinationResolver";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveMarkupRules } from "../utils/auth";
import {
  buildPublicPricing,
  calculateNights,
  calculateEnrichedPricing,
  round2,
} from "../utils/pricing.util";
import { getSuggestions } from "./suggestions.service";
import { env } from "../config/env";
import searchResultCache from "../cache/searchResultCache.service";
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

const DEFAULT_PAGE_SIZE = 20;

// What we persist in Redis per search: the pre-markup, deduped, geofenced master
// list plus the destination inventory figure (which is derived from supplier
// totals and so can't be recomputed from the list alone on a cache hit).
interface CachedMaster {
  hotels: UnifiedHotel[];
  inventoryCount: number;
}

export class HotelsService {
  /**
   * Unified Search Entry Point
   * Senior OTA Strategy: Concurrently fetch, partial return on slow providers,
   * and high-efficiency deduplication.
   *
   * Pagination: when Redis is reachable we build a stable, deduplicated master
   * result set once per search (eagerly prefetching the first N supplier pages),
   * cache it, and slice pages from it — so scrolling never re-hits the paid
   * supplier APIs and the same hotel can't appear on two pages. When Redis is
   * down we fall back to live per-page fetching (the original behavior).
   */
  async searchHotels(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C" = "B2C",
    token?: string | null,
  ) {
    const totalStartTime = Date.now();
    // Resolves the agent's rules for B2B / the master's B2C rule for B2C, and
    // refreshes the platform-markup snapshot the adapters read synchronously.
    const markupRules = await resolveMarkupRules(clientType, token ?? null);
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

    // Serve identical anonymous searches from the short-TTL L1 cache to spare the
    // paid supplier APIs. Keyed on the whole request (minus the geo center we
    // resolve below). B2B (token) requests are never cached here.
    const cacheable = !token;
    const cacheKey = cacheable
      ? JSON.stringify({ ...searchPayload, _geoCenter: undefined, __ct: clientType })
      : "";
    if (cacheable) {
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
        console.log(`[Search] L1 cache hit for "${searchPayload.destination}"`);
        return cached.data;
      }
    }

    // 1. Resolve Location (Once) — shared by every supplier page we fetch below.
    await this.resolveGeoCenter(searchPayload);

    const pageNo = Math.max(1, Number(searchPayload.pageNo) || 1);
    const limit = Math.max(1, Number(searchPayload.limit) || DEFAULT_PAGE_SIZE);

    let response: any;

    if (searchResultCache.ready()) {
      // ── Redis path: cache the deduped master list, slice pages from it ──────
      const masterKey = this.buildMasterKey(searchPayload, clientType);
      let master = await searchResultCache.get<CachedMaster>(masterKey);

      if (master) {
        console.log(
          `[Search] master cache HIT for "${searchPayload.destination}" (${master.hotels.length} hotels) — serving page ${pageNo} from cache`,
        );
      } else {
        console.log(
          `[Search] master cache MISS for "${searchPayload.destination}" — eagerly fetching ${env.searchPrefetchPages} page(s)`,
        );
        const built = await this.fetchMasterList(
          searchPayload,
          clientType,
          env.searchPrefetchPages,
        );
        master = { hotels: built.hotels, inventoryCount: built.inventoryCount };
        await searchResultCache.set(masterKey, master);
      }

      response = this.finalizeResponse(
        master.hotels,
        searchPayload,
        clientType,
        markupRules,
        nights,
        master.inventoryCount,
        { slice: true, page: pageNo, limit },
      );
    } else {
      // ── Fallback path (Redis down): live-fetch only the requested page ──────
      console.warn(
        `[Search] Redis unavailable — falling back to live per-page fetch for "${searchPayload.destination}"`,
      );
      const built = await this.fetchMasterList(searchPayload, clientType, 1, pageNo);
      response = this.finalizeResponse(
        built.hotels,
        searchPayload,
        clientType,
        markupRules,
        nights,
        built.inventoryCount,
        { slice: false, legacyHasMore: built.providerHasMore },
      );
    }

    console.log(
      `[Search] "${searchPayload.destination}" page ${pageNo} served in ${Date.now() - totalStartTime}ms`,
    );

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
   * Resolve the destination to a geo center once and stash it on the payload so
   * every supplier page reuses it. Mutates searchPayload._geoCenter.
   */
  private async resolveGeoCenter(searchPayload: UnifiedSearchRequest): Promise<void> {
    const isDirectSearch = supplierRegistry.isDirectSearch(searchPayload.destination);
    if (isDirectSearch) {
      console.log(
        `[DEBUG] Direct hotel search detected for "${searchPayload.destination}".`,
      );
    }

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
  }

  /**
   * Fan out to every eligible supplier for a single page and return the raw
   * (un-deduplicated) hotels plus per-supplier stats. One AbortController per
   * page cancels any supplier still in flight once the partial-return window
   * elapses.
   */
  private async fetchOnePage(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    pageNo: number,
  ): Promise<{
    hotels: UnifiedHotel[];
    providerStats: Record<string, { count: number; total: number; hasMore: boolean }>;
  }> {
    const startTime = Date.now();
    const mode = process.env.HOTEL_PROVIDER_MODE || "UNIFIED";
    const pageResults: UnifiedHotel[] = [];
    const providerStats: Record<string, { count: number; total: number; hasMore: boolean }> = {};

    // Fan out to every supplier enabled for this mode/destination/providers-filter.
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

    // One AbortController for this page. Its signal is threaded into every
    // supplier's underlying axios call; once we decide to return (all settled or
    // the partial-return window elapsed) we abort it, so a slow supplier's HTTP
    // request is actively cancelled instead of orphaned until its own timeout.
    const abortController = new AbortController();
    const pagePayload: UnifiedSearchRequest = {
      ...searchPayload,
      pageNo,
      _abortSignal: abortController.signal,
    };

    const allTasks = enabledSuppliers.map((supplier) =>
      supplier
        .search(pagePayload, clientType)
        .then((res) => {
          providerStats[supplier.code] = {
            count: res.hotels.length,
            total: res.total,
            hasMore: res.hasMore,
          };
          pageResults.push(...res.hotels);
          console.log(
            `[OK] ${supplier.code} page ${pageNo} finished in ${Date.now() - startTime}ms (${res.hotels.length} hotels)`,
          );
        })
        .catch((err) => {
          console.error(`[ERR] ${supplier.code} page ${pageNo} failed: ${err.message}`);
        }),
    );

    // Wait for all providers, but cap at 15 seconds for partial-result return (MMT-style).
    // RG typically responds in 2-5s, TJ in 4-6s. 15s covers almost all cases.
    const PARTIAL_RETURN_TIMEOUT_MS = 15000;
    let partialTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled(allTasks),
      new Promise<void>((resolve) => {
        partialTimer = setTimeout(resolve, PARTIAL_RETURN_TIMEOUT_MS);
      }),
    ]);
    if (partialTimer) clearTimeout(partialTimer);
    abortController.abort();

    return { hotels: pageResults, providerStats };
  }

  /**
   * Build the deduplicated, geofenced master list for a search by fetching
   * `pages` supplier pages sequentially (sequential access keeps TripJack's WAF
   * happy) and deduplicating the union once. `startPage` lets the Redis-down
   * fallback fetch just the one page the client asked for.
   */
  private async fetchMasterList(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    pages: number,
    startPage = 1,
  ): Promise<{ hotels: UnifiedHotel[]; inventoryCount: number; providerHasMore: boolean }> {
    const collected: UnifiedHotel[] = [];
    const providerStats: Record<string, { count: number; total: number; hasMore: boolean }> = {};

    for (let i = 0; i < pages; i++) {
      const pageNo = startPage + i;
      const { hotels, providerStats: pageStats } = await this.fetchOnePage(
        searchPayload,
        clientType,
        pageNo,
      );
      collected.push(...hotels);
      // Keep the latest stats per supplier — `total` is stable across pages and
      // `hasMore` from the last page fetched reflects whether more remain.
      for (const [code, stat] of Object.entries(pageStats)) {
        providerStats[code] = stat;
      }
      // Stop early if no supplier has more pages — nothing to gain from fetching further.
      const anyMore = Object.values(pageStats).some((s) => s.hasMore);
      if (!anyMore) break;
    }

    // Deduplication (MMT-style efficient dedup) across the whole union.
    const totalReceivedCount = collected.length;
    const { items: deduplicatedResults, meta: dedupMeta } =
      deduplicateHotels(collected);

    // Whether any supplier still had pages left after the last page we fetched
    // (used only by the Redis-down fallback path).
    const providerHasMore = Object.values(providerStats).some((s) => s.hasMore);

    // How many properties we know of in this destination — the "6,179 properties
    // in Goa" figure, not the subset bookable on these dates. Deliberately the
    // largest supplier's count, never the sum (the same hotel is listed by both
    // suppliers, so summing double-counts). Zero when the destination is empty.
    const providerTotals = Object.values(providerStats).map((s) => s.total);
    const inventoryCount = deduplicatedResults.length
      ? Math.max(...providerTotals, deduplicatedResults.length)
      : 0;

    // Geofence: drop hotels outside the resolved radius.
    const geoCenter = searchPayload._geoCenter;
    let finalOutputHotels = deduplicatedResults;
    if (geoCenter) {
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
        `[GEO] Dynamic geofence: ${allowedRadiusKm.toFixed(2)}km radius around [${geoCenter.lat}, ${geoCenter.lng}]. Kept ${finalOutputHotels.length}/${deduplicatedResults.length} hotels.`,
      );
    }

    console.log(
      `[Search] master list built: received ${totalReceivedCount}, unique ${deduplicatedResults.length} ` +
        `(merged ${dedupMeta.duplicatedCount}), after geofence ${finalOutputHotels.length}, inventory ${inventoryCount}`,
    );

    return { hotels: finalOutputHotels, inventoryCount, providerHasMore };
  }

  /**
   * Turn a master list into the client response: accumulate facets, apply
   * filters + sort, bake in markup, then either slice a page (Redis path) or
   * return the whole set (Redis-down fallback). Deterministic given the master
   * list + request params, so it runs per request rather than being cached.
   */
  private finalizeResponse(
    master: UnifiedHotel[],
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    markupRules: any[],
    nights: number,
    inventoryCount: number,
    opts: { slice: boolean; page?: number; limit?: number; legacyHasMore?: boolean },
  ) {
    // 1. Fold the master list into the search's running facets and return the
    //    cumulative counts. Built from the unfiltered/geofenced list so that
    //    applying a filter never zeroes out the options the user didn't pick.
    const facetKey = buildFacetKey(searchPayload, clientType, markupRules);
    const facets = accumulateFacets(facetKey, master, markupRules, nights);

    // 2. Apply filters (if provided)
    let filteredResults = master;
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
      filteredResults = filteredResults.slice().sort((a, b) => {
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

    // 4. Paginate: slice the requested page from the processed list (Redis path),
    //    or take the whole set when the fallback already fetched a single page.
    let hasMore: boolean;
    let pageItems: UnifiedHotel[];
    if (opts.slice) {
      const page = Math.max(1, opts.page || 1);
      const limit = Math.max(1, opts.limit || DEFAULT_PAGE_SIZE);
      const start = (page - 1) * limit;
      const end = start + limit;
      pageItems = filteredResults.slice(start, end);
      hasMore = end < filteredResults.length;
    } else {
      pageItems = filteredResults;
      hasMore = opts.legacyHasMore ?? false;
    }

    // 5. Bake markup into the returned price (single source of truth — same as the
    //    detail/products path). Search returns FINAL prices; the frontend renders
    //    them verbatim (no client-side markup). B2C / no-rule => markup 0.
    const optimizedResults = pageItems.map((hotel) => {
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

      const publicPricing = buildPublicPricing({
        enriched,
        taxes: hotel.taxAmount ?? 0,
        mf: 0,
        mft: 0,
        currency: hotel.currency,
        clientType,
      });

      return {
        ...rest,
        // price is the sell price on both channels (B2C: +master margin, B2B:
        // +agent margin), so it stays keyed off finalTotalPrice.
        price: round2(enriched.finalTotalPrice),
        // basePrice INCLUDES the master's margin on B2C: the card's headline
        // per-night number is derived from it, so leaving the margin out
        // advertised a price we would not honour at review.
        basePrice: publicPricing.basePrice,
        altDeal,
        pricing: {
          ...(rest.pricing || {}),
          ...publicPricing,
        },
        correlationId: (rawPayload as any)?._correlationId || hotel.correlationId || "",
      };
    });

    return {
      results: optimizedResults,
      body: optimizedResults, // Fallback for some frontend components
      hotels: optimizedResults,
      // Hotels on this page. The client accumulates across pages and uses
      // `hasMore` to decide whether to ask for another one.
      total: optimizedResults.length,
      hasMore,
      // Properties we hold for this destination, for "Showing 40 of 6,179".
      // Display only — never drives paging.
      inventoryCount,
      facets,
      meta: {
        tjCount: providerStats['TJ']?.total || 0,
        rgCount: providerStats['RG']?.total || 0,
      },
    };
  }

  /**
   * Stable Redis key for a search's master list. Excludes pageNo/limit/filters/
   * sortBy and the auth token (all applied per request in finalizeResponse), but
   * includes clientType because RateGain maps prices differently per client type.
   */
  private buildMasterKey(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
  ): string {
    const identity = {
      d: (searchPayload.destination || "").trim().toLowerCase(),
      dc: searchPayload.destinationCode || "",
      ci: searchPayload.checkin,
      co: searchPayload.checkout,
      rooms: searchPayload.rooms,
      cur: searchPayload.currency || "INR",
      cc: searchPayload.countryCode || "IN",
      prov: (searchPayload.providers || []).slice().sort(),
      ct: clientType,
    };
    const hash = crypto
      .createHash("sha1")
      .update(JSON.stringify(identity))
      .digest("hex");
    return `hsearch:v1:${hash}`;
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
