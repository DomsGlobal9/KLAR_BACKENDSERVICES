import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

export const env = {
  port: process.env.PORT || 5012,
  jwtSecret:
    process.env.JWT_SECRET ||
    "your_super_secret_jwt_key_change_me_in_production",
  mongoUri: process.env.MONGODB_URI || "",

  // Redis + backend pagination. A search's deduplicated master result set is
  // cached (L1 in-process, then Redis) and pages are sliced from it. See
  // hotels.service.ts for how the layers fit together.
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",

  // Supplier pages the request WAITS for before responding. This is the number
  // that sets time-to-first-result, so it is deliberately 1: one page is a full
  // screen of hotels, and everything past it is fetched in the background while
  // the user is already reading. Raising it multiplies the cold-search wait,
  // because supplier pages are fetched sequentially (TripJack's WAF).
  searchBlockingPages: Number(process.env.SEARCH_BLOCKING_PAGES || 1),
  // Depth the master list is warmed to in the BACKGROUND right after the first
  // response is sent, so the second and third scroll are already paid for.
  searchPrefetchPages: Number(process.env.SEARCH_PREFETCH_PAGES || 3),
  // How many further supplier pages to pull each time the client scrolls past
  // what the master list already holds. The prefetch above is only a head start
  // — the list grows on demand from here, so it is never capped at the prefetch
  // depth while suppliers still have inventory left.
  searchExtendPages: Number(process.env.SEARCH_EXTEND_PAGES || 2),

  // Hard TTL: how long a master list may live in Redis at all.
  searchResultCacheTtl: Number(process.env.SEARCH_RESULT_CACHE_TTL || 900),
  // Soft TTL: past this age an entry is still served immediately, but a refresh
  // is kicked off behind the response (stale-while-revalidate). The user never
  // waits for it, and supplier volume is unchanged — it just moves off the
  // critical path. Must be < searchResultCacheTtl or SWR never engages.
  searchResultFreshTtl: Number(process.env.SEARCH_RESULT_FRESH_TTL || 300),

  // L1: per-process master cache in front of Redis. Absorbs bursts of identical
  // searches and keeps search cached at all when Redis is down. Kept short
  // because a second instance can grow the shared Redis copy underneath it.
  searchL1TtlMs: Number(process.env.SEARCH_L1_TTL_MS || 20_000),
  searchL1MaxEntries: Number(process.env.SEARCH_L1_MAX_ENTRIES || 150),

  // Soft partial-return window per supplier page: once it elapses we return the
  // instant we hold ≥1 hotel. Kept tight (8s) because it is time the user spends
  // staring at a spinner. NOTE: RateGain's bestproperties is not the "2-5s" older
  // comments assumed — measured live it is ~10.7s domestic and ~14.2s for an
  // international geofilter search, so the HARD cap past this window
  // (SEARCH_TIMEOUT_GRACE_MS, see hotels.service.ts) must clear ~15s or slow
  // destinations abort RG right before its data lands and return zero hotels.
  searchBlockingTimeoutMs: Number(process.env.SEARCH_BLOCKING_TIMEOUT_MS || 8000),
  searchBackgroundTimeoutMs: Number(
    process.env.SEARCH_BACKGROUND_TIMEOUT_MS || 15000,
  ),

  // TripJack candidate-id lists are a Mongo $near over a static hotel
  // collection — same answer every time for a given centre+radius, so they are
  // cached for a day rather than re-run on every cold search.
  tjHidCacheTtl: Number(process.env.TJ_HID_CACHE_TTL || 86_400),

  // Cache warmer: periodically runs searches for the busiest destination/date
  // combinations so real users land on an already-built master list. Off by
  // default — it spends supplier quota.
  enableSearchWarmup: process.env.ENABLE_SEARCH_WARMUP === "true",
  warmupIntervalMin: Number(process.env.SEARCH_WARMUP_INTERVAL_MIN || 10),
  warmupGapMs: Number(process.env.SEARCH_WARMUP_GAP_MS || 3000),
  warmupDestinations: (
    process.env.SEARCH_WARMUP_DESTINATIONS ||
    "Goa,Mumbai,New Delhi,Bengaluru,Hyderabad,Chennai,Kolkata,Pune,Jaipur,Udaipur,Manali,Shimla,Rishikesh,Munnar,Ooty,Dubai"
  )
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean),

  rateGain: {
    baseUrl: process.env.RATEGAIN_BASE_URL!,
    apiKey: process.env.RATEGAIN_API_KEY!,
    apiSecret: process.env.RATEGAIN_SECRET_KEY!,
  },
  tripJack: {
    baseUrl:
      process.env.TRIPJACK_BASE_URL || "https://apitest-hms.tripjack.com",
    apiKey: process.env.TRIPJACK_API_KEY!,
    agencyId: process.env.TRIPJACK_AGENCY_ID!,
  },

  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:5010",
};
if (!env.rateGain.baseUrl) {
  console.error("❌ RATEGAIN_BASE_URL is not set. Service will not work.");
}
if (!env.rateGain.apiKey) {
  console.error("❌ RATEGAIN_API_KEY is not set. Service will not work.");
}
if (!env.tripJack.apiKey) {
  console.warn(
    "⚠️ TRIPJACK_API_KEY is not set. TripJack integration may fail.",
  );
}
