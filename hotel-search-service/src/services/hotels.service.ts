import { supplierRegistry } from "../suppliers";
import { resolveCityToCoords, resolveGeoCenter } from "./destinationResolver";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { getMarkupRules } from "../utils/auth";
import { calculateNights, calculateEnrichedPricing, round2 } from "../utils/pricing.util";

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
      const emptyFacets = computeFacets([], markupRules, nights);
      return {
        results: [],
        body: [],
        hotels: [],
        total: 0,
        facets: emptyFacets,
      };
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
      if (searchPayload.destinationCode && searchPayload.destinationCode.startsWith("GEO:")) {
        const coords = searchPayload.destinationCode.replace("GEO:", "").split(",");
        if (coords.length === 2) {
          const lat = parseFloat(coords[0]);
          const lng = parseFloat(coords[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            const geoFromToken = await resolveGeoCenter(lat, lng);

            // ── Cross-validate the GEO token against the text destination ──────
            // A stale/wrong GEO token (e.g. Philippines "Goa" instead of Indian
            // "Goa") can arrive from session-cached search params. If the text
            // destination resolves to a very different place (>500 km away), we
            // discard the bad token and use the text resolution instead.
            if (searchPayload.destination && searchPayload.destination.trim().length > 2) {
              const geoFromText = await resolveCityToCoords(searchPayload.destination);
              if (geoFromText) {
                const dist = getDistanceKm(
                  geoFromToken.lat, geoFromToken.lng,
                  geoFromText.lat, geoFromText.lng,
                );
                if (dist > 500) {
                  console.warn(
                    `[GEO] ⚠️  GEO token [${lat},${lng}] is ${dist.toFixed(0)}km from text-resolved ` +
                    `"${searchPayload.destination}" [${geoFromText.lat},${geoFromText.lng}]. ` +
                    `Discarding bad GEO token — using text resolution.`,
                  );
                  geoCenter = geoFromText;
                } else {
                  geoCenter = geoFromToken;
                  console.log(
                    `[GEO] Instant resolution from GEO token: Lat=${geoCenter.lat}, Lng=${geoCenter.lng}, Radius=${geoCenter.radiusKm}km (validated, ${dist.toFixed(0)}km from text)`,
                  );
                }
              } else {
                // Text resolution failed — trust the GEO token
                geoCenter = geoFromToken;
                console.log(`[GEO] Instant resolution from GEO token: Lat=${geoCenter.lat}, Lng=${geoCenter.lng}, Radius=${geoCenter.radiusKm}km (resolved)`);
              }
            } else {
              geoCenter = geoFromToken;
              console.log(`[GEO] Instant resolution from GEO token: Lat=${geoCenter.lat}, Lng=${geoCenter.lng}, Radius=${geoCenter.radiusKm}km (resolved)`);
            }
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
    const providerStats: Record<string, { count: number; total: number }> = {};

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

    const allTasks = enabledSuppliers.map((supplier) =>
      supplier
        .search(searchPayload, clientType)
        .then((res) => {
          providerStats[supplier.code] = { count: res.hotels.length, total: res.total };
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
    const sumProviderTotals = Object.values(providerStats).reduce(
      (sum, s) => sum + s.total,
      0,
    );
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
Reported Total to UI:      ${totalToUI}
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
      if (filters.priceRange && filters.priceRange[1] > 0) {
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

    return {
      results: optimizedResults,
      body: optimizedResults, // Fallback for some frontend components
      hotels: optimizedResults,
      total: Math.max(sumProviderTotals, filteredResults.length),
      facets,
    };
  }

  async getHotelSuggestions(query: string) {
    const { HotelModel } = require("../models/Hotel.model");
    const { City, State, Country } = require("country-state-city");

    if (!query || query.trim().length < 2) return [];

    // Normalize common typos
    let normalizedQuery = query.trim();
    if (/anaya/i.test(normalizedQuery)) {
      normalizedQuery = normalizedQuery.replace(/anaya/gi, "ananya");
    }
    const qLower = normalizedQuery.toLowerCase();

    // ─── 1. COLLECT ALL MATCHING STATES (primary destinations) ───────────────
    const allStates = State.getAllStates();
    type StateMatch = { state: any; score: number };
    const stateMatches: StateMatch[] = [];

    for (const state of allStates) {
      const nameLower = state.name.toLowerCase();
      // Score 1: state name starts with query (highest — "Goa" for "goa")
      if (nameLower.startsWith(qLower)) {
        stateMatches.push({ state, score: 1 });
      }
      // Score 2: every query word appears in state name
      else {
        const qWords = qLower.split(/\s+/).filter((w) => w.length > 1);
        if (qWords.length > 1 && qWords.every((w) => nameLower.includes(w))) {
          stateMatches.push({ state, score: 2 });
        }
      }
    }

    // Sort: India first, then score, then name length
    stateMatches.sort((a, b) => {
      const aIN = a.state.countryCode === "IN" ? 0 : 1;
      const bIN = b.state.countryCode === "IN" ? 0 : 1;
      if (aIN !== bIN) return aIN - bIN;
      if (a.score !== b.score) return a.score - b.score;
      return a.state.name.length - b.state.name.length;
    });

    // ─── 2. COLLECT ALL MATCHING CITIES ──────────────────────────────────────
    const allCities = City.getAllCities();
    type CityMatch = { city: any; score: number };
    const cityMatches: CityMatch[] = [];

    for (const city of allCities) {
      const nameLower = city.name.toLowerCase();

      // Score 1: full name starts with the entire query — best match ("Rio de" → "Rio de Janeiro")
      if (nameLower.startsWith(qLower)) {
        cityMatches.push({ city, score: 1 });
        continue;
      }

      // Score 2: each space-separated word in query appears in the city name
      // (single-char "connecting" words like "de", "di", "al" are included intentionally)
      const qWords = qLower.split(/\s+/).filter(Boolean);
      if (qWords.length > 1 && qWords.every((w) => nameLower.includes(w))) {
        cityMatches.push({ city, score: 2 });
        continue;
      }

      // Score 3: first significant word is a prefix of city name
      const firstWord = qWords[0] || qLower;
      if (firstWord.length >= 3 && nameLower.startsWith(firstWord)) {
        cityMatches.push({ city, score: 3 });
      }
    }

    // Fuzzy fallback when we have very few results
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

    // Sort cities: India first, score, shorter name first
    cityMatches.sort((a, b) => {
      const aIN = a.city.countryCode === "IN" ? 0 : 1;
      const bIN = b.city.countryCode === "IN" ? 0 : 1;
      if (aIN !== bIN) return aIN - bIN;
      if (a.score !== b.score) return a.score - b.score;
      return a.city.name.length - b.city.name.length;
    });

    // ─── 3. BUILD NAME AMBIGUITY MAP (for smart labeling) ────────────────────
    // A name is "ambiguous" if it appears in more than one country globally.
    // e.g. "Hyderabad" exists in India AND Pakistan → show "Hyderabad, India"
    // "Goa" only exists in India → show just "Goa"
    const stateName2Countries = new Map<string, Set<string>>();
    for (const state of allStates) {
      const key = state.name.toLowerCase();
      if (!stateName2Countries.has(key)) stateName2Countries.set(key, new Set());
      stateName2Countries.get(key)!.add(state.countryCode);
    }

    const cityName2Countries = new Map<string, Set<string>>();
    for (const city of allCities) {
      const key = city.name.toLowerCase();
      if (!cityName2Countries.has(key)) cityName2Countries.set(key, new Set());
      cityName2Countries.get(key)!.add(city.countryCode);
    }

    const isStateAmbiguous = (name: string) =>
      (stateName2Countries.get(name.toLowerCase())?.size ?? 0) > 1;
    const isCityAmbiguous = (name: string) =>
      (cityName2Countries.get(name.toLowerCase())?.size ?? 0) > 1;

    // ─── 4. SMART LABEL HELPER ───────────────────────────────────────────────
    const getCountryName = (code: string) => {
      const c = Country.getCountryByCode(code);
      return c ? c.name : code;
    };

    // ─── 5. BUILD PRIMARY STATE RESULTS WITH SUB-CITY SUGGESTIONS ────────────
    // IMPORTANT: We intentionally do NOT use `country-state-city` lat/lng for
    // the primary state destCode. Those coordinates are unreliable and can point
    // to the wrong country (e.g. Goa Philippines instead of Goa India).
    // Instead, we leave destCode empty so the backend falls back to the proven
    // OpenCage/MongoDB geocaching pipeline which correctly resolves "Goa" → India.
    const results: any[] = [];
    const usedStateCodes = new Set<string>(); // stateCode+countryCode
    const usedStateNames = new Set<string>(); // name+countryCode

    for (const { state } of stateMatches.slice(0, 3)) {
      const stateKey = `${state.isoCode}::${state.countryCode}`;
      if (usedStateCodes.has(stateKey)) continue;
      usedStateCodes.add(stateKey);
      usedStateNames.add(`${state.name.toLowerCase()}::${state.countryCode}`);

      // Label: only add country when ambiguous across multiple countries
      const ambiguous = isStateAmbiguous(state.name);
      const countryFull = getCountryName(state.countryCode);
      const countryLabel = ambiguous ? `, ${countryFull}` : "";
      const label = `${state.name}${countryLabel}`;
      const subtitle = `City in ${countryFull}`;

      // Unique but non-GEO id (safe for deduplication; NOT passed as a GEO token)
      const stateId = `STATE:${state.countryCode}:${state.isoCode}`;

      // Sub-cities within this state
      const stateCities: any[] = City.getCitiesOfState(state.countryCode, state.isoCode) || [];
      const queryMatchesStateName =
        state.name.toLowerCase().startsWith(qLower) ||
        qLower.startsWith(state.name.toLowerCase());

      let subCities: any[] = [];
      if (queryMatchesStateName) {
        // Query is the whole state name → show top discovery sub-cities
        subCities = stateCities
          .filter((c: any) => c.name.toLowerCase() !== state.name.toLowerCase())
          .slice(0, 5);
      } else {
        // Query partially matches state → show matching sub-cities
        subCities = stateCities
          .filter(
            (c: any) =>
              c.name.toLowerCase().startsWith(qLower) ||
              c.name.toLowerCase().includes(qLower),
          )
          .slice(0, 5);
      }

      const subSuggestions = subCities.map((c: any, idx: number) => ({
        // Sub-city destCode is just the city name — backend geocodes it correctly
        id: `CITY:${c.name}:${state.isoCode}:${state.countryCode}`,
        name: c.name,
        destCode: "", // empty → text-resolution in backend
        subtitle: `in ${state.name}`,
        tag: idx === 0 ? "POPULAR" : idx === 1 ? "TRENDING" : undefined,
      }));

      results.push({
        id: stateId,
        destCode: "",          // ← empty: backend will text-resolve using `name`
        destName: label,
        label,
        name: label,
        type: "city",
        source: "GEO",
        subtitle,
        subSuggestions,
      });
    }

    // ─── 6. ADD INDIVIDUAL CITY RESULTS (for cities not covered by states above) ─
    // Avoid showing a city if its parent state is already in results
    for (const { city } of cityMatches.slice(0, 12)) {
      if (results.length >= 6) break;

      const stateKey = `${city.stateCode}::${city.countryCode}`;
      const nameKey = `${city.name.toLowerCase()}::${city.countryCode}`;
      
      // Skip if parent state already shown as primary result (by code or exact name match)
      if (usedStateCodes.has(stateKey) || usedStateNames.has(nameKey)) continue;

      const ambiguous = isCityAmbiguous(city.name);
      const countryLabel = ambiguous ? `, ${getCountryName(city.countryCode)}` : "";
      const label = `${city.name}${countryLabel}`;

      const stateObj = State.getStateByCodeAndCountry(city.stateCode, city.countryCode);
      const stateName = stateObj?.name || city.stateCode;
      const countryFull = getCountryName(city.countryCode);
      const subtitle = stateName && stateName !== city.name
        ? `City in ${stateName}, ${countryFull}`
        : `City in ${countryFull}`;

      const geoId = `GEO:${city.latitude},${city.longitude}`;

      results.push({
        id: geoId,
        destCode: geoId,
        destName: label,
        label,
        name: label,
        type: "city",
        source: "GEO",
        subtitle,
        subSuggestions: [],
      });
    }

    // ─── 7. ADD HOTEL NAME MATCHES ────────────────────────────────────────────
    const escapedQuery = normalizedQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const prefixRegex = new RegExp("^" + escapedQuery, "i");
    const containsRegex = new RegExp(escapedQuery, "i");

    let hotels = await HotelModel.find({
      $or: [{ name: prefixRegex }, { cityName: prefixRegex }],
    })
      .limit(12)
      .lean();

    if (hotels.length < 6) {
      const extraHotels = await HotelModel.find({
        $or: [{ name: containsRegex }, { cityName: containsRegex }],
        _id: { $nin: hotels.map((h: any) => h._id) },
      })
        .limit(12 - hotels.length)
        .lean();
      hotels = [...hotels, ...extraHotels];
    }

    const hotelSuggestions = hotels.map((h: any) => {
      const hotelId = h.tjHotelId.startsWith("TJ:") ? h.tjHotelId : `TJ:${h.tjHotelId}`;
      return {
        id: hotelId,
        hotelId,
        label: `${h.name}, ${h.cityName}`,
        name: h.name,
        type: "hotel",
        source: "TJ",
        city: h.cityName,
        subtitle: `Hotel in ${h.cityName}`,
      };
    });

    const allResults = [...results, ...hotelSuggestions];

    // Final deduplication by label
    const uniqueResults = Array.from(
      new Map(allResults.map((item) => [item.label.toLowerCase().trim(), item])).values()
    );

    return uniqueResults;
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
  const providerCounts: Record<string, number> = Object.fromEntries(
    supplierRegistry.all().map((s) => [s.code, 0]),
  );
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
    if (hotel.source && hotel.source in providerCounts) {
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
