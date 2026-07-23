import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

export const env = {
  port: process.env.PORT || 5012,
  jwtSecret:
    process.env.JWT_SECRET ||
    "your_super_secret_jwt_key_change_me_in_production",
  mongoUri: process.env.MONGODB_URI || "",

  // Redis + backend pagination. When Redis is reachable, a search's deduplicated
  // master result set is cached and pages are sliced from it; on a cache miss the
  // first `searchPrefetchPages` supplier pages are fetched eagerly. When Redis is
  // down, search falls back to live per-page fetching (see hotels.service.ts).
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  searchPrefetchPages: Number(process.env.SEARCH_PREFETCH_PAGES || 1),
  // How many further supplier pages to pull each time the client scrolls past
  // what the master list already holds. The prefetch above is only a head start
  // — the list grows on demand from here, so it is never capped at the prefetch
  // depth while suppliers still have inventory left.
  searchExtendPages: Number(process.env.SEARCH_EXTEND_PAGES || 2),
  searchResultCacheTtl: Number(process.env.SEARCH_RESULT_CACHE_TTL || 300),

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
