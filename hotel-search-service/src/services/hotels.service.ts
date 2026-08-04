import crypto from "crypto";
import { supplierRegistry } from "../suppliers";
import { resolveCityToCoords, resolveGeoCenter } from "./destinationResolver";
import { deduplicateHotels } from "./deduplicator";
import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveMarkupRules } from "../utils/auth";
import { deriveRegion } from "../utils/region.util";
import {
  buildPublicPricing,
  calculateNights,
  calculateEnrichedPricing,
  round2,
} from "../utils/pricing.util";
import { getSuggestions } from "./suggestions.service";
import { HotelModel } from "../models/Hotel.model";
import { env } from "../config/env";
import searchResultCache from "../cache/searchResultCache.service";
import { LruCache } from "../utils/lruCache";
import {
  accumulateFacets,
  buildFacetKey,
  emptyFacets,
  getMealTypes,
  getPropertyTypeLabel,
} from "./facets.service";

// 20 was the whole reason the results page felt thin — one screen of cards and
// then a fetch. With RG now contributing ~80/page alongside TripJack's ~100 the
// master list is deep enough to serve a larger page without extra supplier work.
const DEFAULT_PAGE_SIZE = Math.max(1, Number(process.env.SEARCH_PAGE_SIZE || 30));
// Hard ceiling on the client-supplied `limit`.
const MAX_PAGE_SIZE = Math.max(
  DEFAULT_PAGE_SIZE,
  Number(process.env.SEARCH_MAX_PAGE_SIZE || 100),
);

// Ceiling on how many times a single request will extend the master list. Guards
// against a supplier that keeps claiming `hasMore` while returning nothing new.
const MAX_EXTEND_ROUNDS = 5;

// What we cache per search: the pre-markup, deduped, geofenced master list plus
// the destination inventory figure (which is derived from supplier totals and so
// can't be recomputed from the list alone on a cache hit), plus enough
// bookkeeping to resume fetching where we left off when the client scrolls past
// what we hold.
//
// The list is pre-agent-markup, so one B2B entry serves every agent (and one
// B2C entry every anonymous visitor) — each caller's markup is applied per
// request in finalizeResponse. Only clientType splits the key, because RateGain
// maps prices differently for B2B and B2C.
interface CachedMaster {
  hotels: UnifiedHotel[];
  inventoryCount: number;
  // Supplier pages consumed so far; the next extension resumes at +1.
  supplierPagesFetched: number;
  // Whether any supplier still had a page left after the last one we fetched.
  providerHasMore: boolean;
  // When the supplier data was last pulled, for stale-while-revalidate.
  builtAt: number;
}

// ── Caching layers ───────────────────────────────────────────────────────────
// L1 (per-process, ~20s): the master list, keyed identically to the Redis entry.
// Absorbs bursts of identical searches without a Redis round-trip and keeps
// search cached at all when Redis is down.
const l1Master = new LruCache<CachedMaster>(
  env.searchL1MaxEntries,
  env.searchL1TtlMs,
);

// Coalesces concurrent identical master builds. Without this, fifty users
// searching Goa in the same five seconds each trigger their own full supplier
// fan-out; with it they share one and the other forty-nine cost nothing.
const inFlightMasters = new Map<string, Promise<CachedMaster>>();

// Coalesces concurrent *extensions* of the same master. A user scrolling to
// page 2 and the background prefetch top-up would otherwise both fetch the same
// next supplier pages; sharing one grow keeps a scroll from doubling supplier
// load. Deduplication already makes the result correct — this makes it cheap.
const inFlightGrows = new Map<string, Promise<CachedMaster>>();

// Master keys with a background refresh or top-up already running, so a burst of
// stale hits schedules exactly one rebuild rather than one per request.
const backgroundJobs = new Set<string>();

export class HotelsService {
  /**
   * Unified Search Entry Point
   * Senior OTA Strategy: Concurrently fetch, partial return on slow providers,
   * and high-efficiency deduplication.
   *
   * Pagination: we build a stable, deduplicated master result set once per
   * search, cache it (L1 then Redis), and slice pages from it — so scrolling
   * never re-hits the paid supplier APIs and the same hotel can't appear on two
   * pages.
   *
   * Latency: the request waits for `searchBlockingPages` supplier page(s) only —
   * enough to fill the first screen — and the remaining prefetch depth is pulled
   * in the background after the response is sent. A stale-but-usable cached list
   * is served immediately and refreshed behind the response. Both mean the user
   * waits for one supplier round-trip at worst, and usually for none at all.
   */
  async searchHotels(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C" = "B2C",
    token?: string | null,
  ) {
    const totalStartTime = Date.now();
    // Resolves the agent's rules for B2B / the master's B2C rule for B2C, and
    // refreshes the platform-markup snapshot the adapters read synchronously.
    // The destination's country decides which region's markup this search is
    // priced under. It is resolved BEFORE any supplier call because the
    // adapters read the platform snapshot synchronously, per rate, and cannot
    // await a config fetch mid-mapping.
    const searchRegion = deriveRegion(searchPayload.countryCode);
    const markupRules = await resolveMarkupRules(
      clientType,
      token ?? null,
      searchRegion,
    );
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

    // 1. Resolve Location (Once) — shared by every supplier page we fetch below.
    await this.resolveGeoCenter(searchPayload);

    const pageNo = Math.max(1, Number(searchPayload.pageNo) || 1);
    // `limit` is client-supplied, so clamp it at both ends. Unbounded before:
    // a request for limit=100000 would have sliced the entire master list into
    // one response.
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchPayload.limit) || DEFAULT_PAGE_SIZE),
    );

    const masterKey = this.buildMasterKey(searchPayload, clientType);
    let master = await this.loadMaster(masterKey);

    if (master) {
      const ageMs = Date.now() - master.builtAt;
      console.log(
        `[Search] master cache HIT for "${searchPayload.destination}" ` +
        `(${master.hotels.length} hotels, age ${Math.round(ageMs / 1000)}s) — serving page ${pageNo} from cache`,
      );
      // Stale-while-revalidate: this response goes out against the cached list
      // regardless; the refresh lands in time for the next visitor.
      if (ageMs > env.searchResultFreshTtl * 1000) {
        this.scheduleRefresh(masterKey, searchPayload, clientType);
      }
    } else {
      console.log(
        `[Search] master cache MISS for "${searchPayload.destination}" — fetching ${env.searchBlockingPages} page(s) inline`,
      );
      // Coalesced so concurrent identical searches share one supplier fan-out.
      master = await this.coalesce(masterKey, async () => {
        const built = await this.fetchMasterList(
          searchPayload,
          clientType,
          env.searchBlockingPages,
          1,
          env.searchBlockingTimeoutMs,
        );
        const fresh: CachedMaster = {
          hotels: built.hotels,
          inventoryCount: built.inventoryCount,
          supplierPagesFetched: built.pagesFetched,
          providerHasMore: built.providerHasMore,
          builtAt: Date.now(),
        };
        // Only cache a non-empty list. An empty build is usually transient — a
        // supplier timing out, not a truly empty destination — and caching it
        // would serve "no hotels" for the whole TTL and suppress the retry that
        // would have succeeded. Returning it uncached lets the next request try
        // again (mirrors warmMaster).
        if (fresh.hotels.length > 0) await this.storeMaster(masterKey, fresh);
        return fresh;
      });
      // Everything past the first screen is fetched after this response is sent,
      // so the next scroll is already paid for by the time it happens.
      this.scheduleTopUp(masterKey, searchPayload, clientType);
    }

    // The prefetch depth is a head start, not a ceiling. If the client has
    // scrolled past what we hold and the suppliers still have pages, pull more
    // and re-cache — otherwise the result set would be permanently capped at
    // the prefetch depth however much inventory the destination really has.
    const needed = pageNo * limit;
    if (master.hotels.length < needed && master.providerHasMore) {
      // growOnce (inside) persists the extended list, so no store is needed here.
      master = await this.extendMasterList(
        masterKey,
        master,
        searchPayload,
        clientType,
        needed,
      );
    }

    const response = this.finalizeResponse(
      master.hotels,
      searchPayload,
      clientType,
      markupRules,
      nights,
      master.inventoryCount,
      { page: pageNo, limit, providerHasMore: master.providerHasMore },
    );

    console.log(
      `[Search] "${searchPayload.destination}" page ${pageNo} served in ${Date.now() - totalStartTime}ms`,
    );

    return response;
  }

  // ── Master list cache plumbing ─────────────────────────────────────────────

  /** L1 first, then Redis (which repopulates L1 on the way back). */
  private async loadMaster(key: string): Promise<CachedMaster | null> {
    const local = l1Master.get(key);
    if (local) return local;

    const remote = await searchResultCache.get<CachedMaster>(key);
    if (!remote) return null;

    // Entries written by an older build carry neither field. Assume the prefetch
    // depth and that suppliers may still have pages — the extension's own "a
    // round that added nothing ends it" guard corrects an optimistic guess
    // cheaply, whereas defaulting to `false` would keep serving the old capped
    // list until the entry expired.
    if (typeof remote.supplierPagesFetched !== "number") {
      remote.supplierPagesFetched = env.searchPrefetchPages;
      remote.providerHasMore = true;
    }
    // No builtAt means we can't date it; treat as just-built rather than forcing
    // an immediate refresh on every such entry at once.
    if (typeof remote.builtAt !== "number") remote.builtAt = Date.now();

    l1Master.set(key, remote);
    return remote;
  }

  private async storeMaster(key: string, master: CachedMaster): Promise<void> {
    l1Master.set(key, master);
    await searchResultCache.set(key, master);
  }

  /**
   * Share one in-flight build per master key. The rejection path deliberately
   * leaves nothing cached, so the next request retries rather than inheriting a
   * failure.
   */
  private coalesce(
    key: string,
    build: () => Promise<CachedMaster>,
  ): Promise<CachedMaster> {
    const existing = inFlightMasters.get(key);
    if (existing) {
      console.log(`[Search] joining in-flight master build for ${key}`);
      return existing;
    }
    const pending = build().finally(() => inFlightMasters.delete(key));
    inFlightMasters.set(key, pending);
    return pending;
  }

  /**
   * Run work after the response has been sent. At most one background job per
   * master key: a burst of stale hits must not turn into a burst of rebuilds.
   * Failures are logged and swallowed — background work must never surface as a
   * failed search or an unhandled rejection.
   */
  private runInBackground(
    key: string,
    label: string,
    job: () => Promise<void>,
  ): void {
    if (backgroundJobs.has(key)) return;
    backgroundJobs.add(key);
    setImmediate(() => {
      job()
        .catch((err: any) =>
          console.warn(`[Search] background ${label} failed for ${key}: ${err?.message}`),
        )
        .finally(() => backgroundJobs.delete(key));
    });
  }

  /**
   * Snapshot of the request for background use. Drops the request-scoped abort
   * signal (aborted the moment the response is sent) and the paging/filter
   * fields, none of which affect the master list.
   */
  private backgroundPayload(
    searchPayload: UnifiedSearchRequest,
  ): UnifiedSearchRequest {
    return {
      ...searchPayload,
      _abortSignal: undefined,
      filters: undefined,
      sortBy: undefined,
    } as UnifiedSearchRequest;
  }

  /**
   * Grow a freshly-built master from the blocking depth to the full prefetch
   * depth, in the background.
   */
  private scheduleTopUp(
    masterKey: string,
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
  ): void {
    const extraPages = env.searchPrefetchPages - env.searchBlockingPages;
    if (extraPages <= 0) return;

    const payload = this.backgroundPayload(searchPayload);
    this.runInBackground(masterKey, "prefetch top-up", async () => {
      const current = await this.loadMaster(masterKey);
      if (!current || !current.providerHasMore) return;

      // Coalesced with any concurrent user-driven extend, so a fast scroll and
      // this top-up never fetch the same supplier pages twice.
      const grown = await this.growOnce(
        masterKey,
        current,
        payload,
        clientType,
        extraPages,
        env.searchBackgroundTimeoutMs,
      );
      console.log(
        `[Search] background top-up for "${payload.destination}": ` +
        `${current.hotels.length} → ${grown.hotels.length} hotels`,
      );
    });
  }

  /**
   * Rebuild a stale master from scratch in the background. An empty rebuild
   * (supplier outage, expired inventory) is discarded rather than overwriting a
   * list that is merely old — stale hotels beat no hotels.
   */
  private scheduleRefresh(
    masterKey: string,
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
  ): void {
    const payload = this.backgroundPayload(searchPayload);
    this.runInBackground(masterKey, "stale refresh", async () => {
      const built = await this.fetchMasterList(
        payload,
        clientType,
        env.searchPrefetchPages,
        1,
        env.searchBackgroundTimeoutMs,
      );
      if (!built.hotels.length) {
        console.warn(
          `[Search] stale refresh for "${payload.destination}" returned nothing — keeping the existing list`,
        );
        return;
      }
      await this.storeMaster(masterKey, {
        hotels: built.hotels,
        inventoryCount: built.inventoryCount,
        supplierPagesFetched: built.pagesFetched,
        providerHasMore: built.providerHasMore,
        builtAt: Date.now(),
      });
      console.log(
        `[Search] stale refresh complete for "${payload.destination}" (${built.hotels.length} hotels)`,
      );
    });
  }

  /**
   * Build a master list for a search without serving a response — used by the
   * cache warmer to pay the cold cost before any user arrives.
   */
  async warmMaster(
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C" = "B2C",
  ): Promise<{ warmed: boolean; hotels: number }> {
    await this.resolveGeoCenter(searchPayload);
    const masterKey = this.buildMasterKey(searchPayload, clientType);

    const existing = await this.loadMaster(masterKey);
    if (existing && Date.now() - existing.builtAt < env.searchResultFreshTtl * 1000) {
      return { warmed: false, hotels: existing.hotels.length };
    }

    const master = await this.coalesce(masterKey, async () => {
      const built = await this.fetchMasterList(
        searchPayload,
        clientType,
        env.searchPrefetchPages,
        1,
        env.searchBackgroundTimeoutMs,
      );
      const fresh: CachedMaster = {
        hotels: built.hotels,
        inventoryCount: built.inventoryCount,
        supplierPagesFetched: built.pagesFetched,
        providerHasMore: built.providerHasMore,
        builtAt: Date.now(),
      };
      // A warm that found nothing is not worth caching: it would mask a real
      // result set for the whole TTL.
      if (fresh.hotels.length) await this.storeMaster(masterKey, fresh);
      return fresh;
    });

    return { warmed: master.hotels.length > 0, hotels: master.hotels.length };
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
    partialReturnTimeoutMs: number,
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

    // Partial-return policy (MMT-style), but never discard a supplier that is
    // about to deliver just because it crossed the window by a hair:
    //  • return the instant every supplier has settled;
    //  • once the soft window elapses, return as soon as we hold ≥1 hotel;
    //  • if the soft window elapses with nothing yet, keep waiting for the first
    //    results up to a hard cap.
    // The last rule is what a densified TripJack needs: its listing fetch can
    // finish under the window but cross it during DB enrichment (~1-2s tail), so
    // a fixed cutoff would return an empty page on any destination where the
    // other supplier also came back empty (e.g. RateGain timing out on Chennai).
    //
    // The grace must clear RateGain's REAL bestproperties latency, not the
    // optimistic "2-5s" the old comments assumed. Measured live: a Rome geofilter
    // search returns 1,913 properties in ~14.2s, a Goa one in ~10.7s.
    //
    // Tradeoff chosen deliberately (see PR/chat): worst-case time-to-result is
    // capped tighter — 6s grace → 14s hard cap — so DOMESTIC searches (Goa 10.7s
    // + ~1-2s enrichment ≈ 12.7s, the primary market) still land inside the cap,
    // while the pathological 20s+ tail is gone. The only casualties are the very
    // slowest INTERNATIONAL geofilter searches (>14s), which may abort RateGain
    // right before its data lands and fall back to whatever TripJack returned.
    // Raise SEARCH_TIMEOUT_GRACE_MS back toward 12000 if those destinations must
    // always include RG. The cap only bites when nothing has come back yet; the
    // instant the first results land past the soft window we return, so healthy
    // searches finish as soon as their slowest supplier does.
    const softMs = partialReturnTimeoutMs;
    const hardMs =
      partialReturnTimeoutMs +
      Number(process.env.SEARCH_TIMEOUT_GRACE_MS || 6000);

    await new Promise<void>((resolve) => {
      const timers: ReturnType<typeof setTimeout>[] = [];
      let finished = false;
      let softElapsed = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        resolve();
      };

      timers.push(
        setTimeout(() => {
          softElapsed = true;
          // COMMENTED OUT: If you want RateGain, we must wait for it!
          // if (pageResults.length > 0) finish(); 
        }, softMs),
      );
      timers.push(setTimeout(finish, hardMs));

      // Everyone done → return. Never rejects: each task swallows its own error.
      Promise.allSettled(allTasks).then(finish);
      // Past the soft window, return the moment the first results land.
      for (const t of allTasks) {
        t.then(() => {
          if (softElapsed && pageResults.length > 0) finish();
        });
      }
    });
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
    partialReturnTimeoutMs = env.searchBlockingTimeoutMs,
  ): Promise<{
    hotels: UnifiedHotel[];
    inventoryCount: number;
    providerHasMore: boolean;
    pagesFetched: number;
  }> {
    const collected: UnifiedHotel[] = [];
    const providerStats: Record<string, { count: number; total: number; hasMore: boolean }> = {};
    let pagesFetched = 0;

    for (let i = 0; i < pages; i++) {
      const pageNo = startPage + i;
      const { hotels, providerStats: pageStats } = await this.fetchOnePage(
        searchPayload,
        clientType,
        pageNo,
        partialReturnTimeoutMs,
      );
      collected.push(...hotels);
      pagesFetched++;
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

    return { hotels: finalOutputHotels, inventoryCount, providerHasMore, pagesFetched };
  }

  /**
   * Grow a cached master list until it covers `needed` hotels (or the suppliers
   * run dry), resuming from the supplier page after the last one consumed.
   * Deduplicates across the union so a hotel we already hold can never reappear
   * on a later page, and preserves existing order so pages already served to the
   * client stay stable.
   */
  private async extendMasterList(
    masterKey: string,
    master: CachedMaster,
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    needed: number,
  ): Promise<CachedMaster> {
    let current = master;

    for (let round = 0; round < MAX_EXTEND_ROUNDS; round++) {
      if (current.hotels.length >= needed || !current.providerHasMore) break;

      console.log(
        `[Search] extending master list for "${searchPayload.destination}": ` +
        `have ${current.hotels.length}, need ${needed} — fetching supplier page(s) from ${current.supplierPagesFetched + 1}`,
      );

      const grown = await this.growOnce(
        masterKey,
        current,
        searchPayload,
        clientType,
        env.searchExtendPages,
        env.searchBlockingTimeoutMs,
      );
      // A coalesced grow can hand back a copy at the same or an even greater
      // depth than this round intended; if it produced nothing new, stop.
      if (grown.hotels.length <= current.hotels.length && !grown.providerHasMore) {
        current = grown;
        break;
      }
      current = grown;
    }

    return current;
  }

  /**
   * Pull `pages` more supplier pages onto an existing master list, resuming from
   * the page after the last one consumed. Deduplicates across the union so a
   * hotel we already hold can never reappear on a later page, and preserves
   * existing order so pages already served to the client stay stable.
   */
  private async growMaster(
    master: CachedMaster,
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    pages: number,
    partialReturnTimeoutMs: number,
  ): Promise<CachedMaster> {
    const built = await this.fetchMasterList(
      searchPayload,
      clientType,
      pages,
      master.supplierPagesFetched + 1,
      partialReturnTimeoutMs,
    );

    const before = master.hotels.length;
    const { items: merged } = deduplicateHotels([
      ...master.hotels,
      ...built.hotels,
    ]);
    const added = merged.length - before;

    const grown: CachedMaster = {
      hotels: merged,
      inventoryCount: Math.max(master.inventoryCount, built.inventoryCount),
      supplierPagesFetched: master.supplierPagesFetched + built.pagesFetched,
      // A round that produced nothing new means the suppliers are effectively
      // exhausted, whatever their `hasMore` flag claims — stop either way.
      providerHasMore: built.providerHasMore && added > 0,
      // Growing the list doesn't re-price what we already hold, so the entry is
      // still only as fresh as its original build.
      builtAt: master.builtAt,
    };

    console.log(
      `[Search] master list grown: +${added} hotels (now ${grown.hotels.length}), ` +
      `supplier pages consumed ${grown.supplierPagesFetched}, more=${grown.providerHasMore}`,
    );

    return grown;
  }

  /**
   * Coalesced single grow: at most one extension of a given master runs at a
   * time, so a user scrolling to page 2 and the background prefetch top-up share
   * one supplier fetch instead of each firing their own. Reloads the freshest
   * cached copy before growing (the background job may have advanced it),
   * falling back to the caller's snapshot if it was evicted, and persists the
   * result so the next reader sees it.
   */
  private growOnce(
    masterKey: string,
    fallback: CachedMaster,
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    pages: number,
    partialReturnTimeoutMs: number,
  ): Promise<CachedMaster> {
    const existing = inFlightGrows.get(masterKey);
    if (existing) {
      console.log(`[Search] joining in-flight master grow for ${masterKey}`);
      return existing;
    }

    const pending = (async () => {
      const current = (await this.loadMaster(masterKey)) ?? fallback;
      if (!current.providerHasMore) return current;

      const grown = await this.growMaster(
        current,
        searchPayload,
        clientType,
        pages,
        partialReturnTimeoutMs,
      );
      if (
        grown.hotels.length !== current.hotels.length ||
        grown.providerHasMore !== current.providerHasMore
      ) {
        await this.storeMaster(masterKey, grown);
      }
      return grown;
    })().finally(() => inFlightGrows.delete(masterKey));

    inFlightGrows.set(masterKey, pending);
    return pending;
  }

  /**
   * Turn a master list into the client response: accumulate facets, apply
   * filters + sort, bake in markup, then slice the requested page.
   * Deterministic given the master list + request params, so it runs per request
   * rather than being cached.
   */
  private finalizeResponse(
    master: UnifiedHotel[],
    searchPayload: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
    markupRules: any[],
    nights: number,
    inventoryCount: number,
    opts: {
      page: number;
      limit: number;
      providerHasMore: boolean;
    },
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
          const hotelCity = (h.city || "").trim().toLowerCase();
          const hotelAddrParts = (h.address || "")
            .split(/[;,]/)
            .map((s: string) => s.trim().toLowerCase())
            .filter(Boolean);
          const fullAddr = (h.address || "").toLowerCase();

          return filters.selectedLocations!.some((loc) => {
            const target = loc.trim().toLowerCase();
            return (
              hotelCity === target ||
              hotelAddrParts.includes(target) ||
              fullAddr.includes(target)
            );
          });
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

    // 4. Paginate: slice the requested page from the processed list.
    const page = Math.max(1, opts.page || 1);
    const limit = Math.max(1, opts.limit || DEFAULT_PAGE_SIZE);
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = filteredResults.slice(start, end);
    // More to serve if this page didn't reach the end of what we hold, or if
    // the suppliers still have pages we haven't pulled into the master list.
    //
    // Never claim more on an *empty* page. A client that jumps far beyond the
    // master list can outrun MAX_EXTEND_ROUNDS, leaving nothing to slice; the
    // suppliers may genuinely have more, but answering "empty, keep asking"
    // strands the client in a loop it can't make progress on. Ending cleanly
    // costs only the deep-jump case — sequential scrolling grows the list a
    // page at a time and never lands here.
    const hasMore =
      pageItems.length > 0 &&
      (end < filteredResults.length || opts.providerHasMore);

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
        tjCount: master.filter(h => h.source === 'TJ').length,
        rgCount: master.filter(h => h.source === 'RG').length,
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

  /**
   * Instant "explore" browse: reads straight from the locally synced hotel
   * catalogue (HotelModel) instead of fanning out to live suppliers. There are
   * no rates here — no dates means no supplier can price anything — so this
   * only serves static content (photos, name, stars, address) fast enough for
   * a browsing UI. Property-type filtering reuses getPropertyTypeLabel so a
   * hotel classified as "Villa" here matches the same label the live search
   * facets use.
   */
  async searchStaticHotels(params: {
    city: string;
    propertyType?: string;
    page?: number;
    pageSize?: number;
  }) {
    const city = (params.city || "").trim();
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
      params.pageSize && params.pageSize > 0 ? params.pageSize : DEFAULT_PAGE_SIZE;

    if (!city) {
      return { hotels: [], hasMore: false, inventoryCount: 0 };
    }

    // Escape regex metacharacters — city comes straight from user input.
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Case-SENSITIVE on purpose. tjHotelSync lowercases and trims every
    // cityName it writes, so lowercasing the query is exact — and only a
    // case-sensitive anchored regex can walk the cityName index. With the `i`
    // flag MongoDB has to scan all ~1.6M documents, which is what made this
    // "instant" browse endpoint take ~1.7s.
    const cityRegex = new RegExp(`^${escaped.toLowerCase()}`);

    const select =
      "tjHotelId name cityName countryName starRating address images location accTypeDesc accMultiDesc";
    const start = (page - 1) * pageSize;

    let pageDocs: any[];
    let inventoryCount: number;
    let hasMore: boolean;

    if (params.propertyType) {
      // Property type is derived in application code, not stored, so this path
      // still has to pull a pool and filter it here.
      const docs = await HotelModel.find({ cityName: cityRegex })
        .select(select)
        .limit(2000)
        .lean();

      const wanted = params.propertyType.toLowerCase();
      const filtered = docs.filter(
        (h) => getPropertyTypeLabel(h).toLowerCase() === wanted,
      );

      inventoryCount = filtered.length;
      pageDocs = filtered.slice(start, start + pageSize);
      hasMore = start + pageSize < filtered.length;
    } else {
      // The common case — the landing page's carousel and the first browse page.
      // Paginating in Mongo instead of pulling 2,000 documents to show 20 cut
      // this from ~1.5s to well under 100ms; the count runs off the cityName
      // index and in parallel rather than as a second round trip.
      const [docs, total] = await Promise.all([
        HotelModel.find({ cityName: cityRegex })
          .select(select)
          .skip(start)
          .limit(pageSize)
          .lean(),
        HotelModel.countDocuments({ cityName: cityRegex }),
      ]);

      pageDocs = docs;
      inventoryCount = total;
      hasMore = start + pageSize < total;
    }

    const hotels = pageDocs.map((h: any) => ({
      id: h.tjHotelId,
      // Same convention the live TripJack adapter uses (propertyCode ===
      // hotelId, brandCode empty) — required so the detail page can fetch
      // room pricing once the user picks dates. Without this, explore-mode
      // cards land on the detail page with no propertyCode and pricing can
      // never be fetched, even after dates are chosen.
      propertyCode: h.tjHotelId,
      brandCode: "",
      name: h.name,
      city: h.cityName,
      country: h.countryName,
      starRating: h.starRating || 0,
      rating: h.starRating || 0,
      address: h.address || "",
      images: h.images || [],
      latitude: h.location?.coordinates?.[1],
      longitude: h.location?.coordinates?.[0],
      source: "STATIC",
    }));

    return {
      hotels,
      hasMore,
      inventoryCount,
    };
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
