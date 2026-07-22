import crypto from "crypto";
import { supplierRegistry } from "../suppliers";
import {
  calculateEnrichedPricing,
  MarkupRule,
  round2,
} from "../utils/pricing.util";
import { LruCache } from "../utils/lruCache";
import { UnifiedSearchRequest } from "../types/unified";

/**
 * Search facets — the counts that drive every filter control in the UI.
 *
 * A search is paged: page 1 brings ~20 hotels, page 2 another ~20, and so on.
 * Computing facets from one page would describe that page alone, so the filter
 * panel would shrink and re-shuffle on every scroll. Instead each page is folded
 * into a per-search accumulator and the *cumulative* counts are returned, so the
 * panel only ever grows as more inventory arrives. The client renders these
 * verbatim and never derives filter options itself.
 *
 * Hotels are counted once, keyed by hotelId, so re-fetching a page (which the
 * client does whenever the user changes a filter) never double-counts.
 *
 * Facets are always computed on the geofenced but *unfiltered* result set.
 * Counting the filtered set would collapse every unselected option to zero the
 * moment a filter is applied.
 */

const FACET_TTL_MS = Number(process.env.FACET_CACHE_TTL_MS || 15 * 60 * 1000);
const FACET_MAX_SEARCHES = Number(process.env.FACET_CACHE_MAX_SEARCHES || 300);

/** Ceiling on hotels tracked per search, so a pathological page loop can't grow the heap without bound. */
const MAX_TRACKED_HOTELS = 5000;

/** Amenities have a long tail; the panel only ever shows the head of it. */
const MAX_AMENITIES = 60;
const MAX_LOCATIONS = 10;
const PRICE_BUCKET_COUNT = 6;

export interface PriceBucket {
  min: number;
  max: number;
  count: number;
}

export interface SearchFacets {
  starRatingCounts: Record<number, number>;
  propertyTypeCounts: Record<string, number>;
  mealTypeCounts: Record<string, number>;
  amenityCounts: Record<string, number>;
  providerCounts: Record<string, number>;
  minPrice: number;
  maxPrice: number;
  topLocations: Array<{ name: string; count: number }>;
  /** Ready-made price ranges for the price filter, with exact hotel counts. */
  priceBuckets: PriceBucket[];
  /** Hotels folded into these facets so far — the denominator for every count above. */
  totalHotels: number;
  /** Hotels with a cheaper cross-provider deal, for the "alternative deals" toggle. */
  altDealCount: number;
}

interface FacetState {
  seen: Set<string>;
  star: Record<number, number>;
  propertyType: Record<string, number>;
  mealType: Record<string, number>;
  amenity: Record<string, number>;
  provider: Record<string, number>;
  location: Record<string, number>;
  prices: number[];
  minPrice: number;
  maxPrice: number;
  altDealCount: number;
}

const facetCache = new LruCache<FacetState>(FACET_MAX_SEARCHES, FACET_TTL_MS);

// ─── Classifiers (shared with the filter-application code in hotels.service) ──

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

export function getPropertyTypeLabel(hotel: any): string {
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

export function getMealTypes(hotel: any): string[] {
  const types = new Set<string>();
  const boardSources = [
    hotel.mealBasis,
    hotel.boardName,
    hotel.boardCode,
    ...(hotel.hotelBoards || []),
  ].filter(Boolean);

  boardSources.forEach((b) => types.add(titleCase(b)));
  return Array.from(types);
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function hotelPrice(hotel: any, markupRules: MarkupRule[], nights: number): number {
  return calculateEnrichedPricing(
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
  ).finalTotalPrice;
}

// ─── Accumulation ────────────────────────────────────────────────────────────

/**
 * Identifies the *search*, not the request: pageNo, filters and sortBy are all
 * excluded so every page of one search folds into the same accumulator, and so
 * changing a filter doesn't discard the facets already collected.
 *
 * markupRules are part of the key because they change the prices the facets are
 * built from — two agents on different markup must not share a price histogram.
 */
export function buildFacetKey(
  req: UnifiedSearchRequest,
  clientType: "B2B" | "B2C",
  markupRules: MarkupRule[],
): string {
  const rooms = (req.rooms || [])
    .map(
      (r) =>
        `${r.adults}a${r.children || 0}c${(r.childAges || []).join(".")}`,
    )
    .join("|");

  const raw = [
    (req.destination || "").trim().toLowerCase(),
    req.destinationCode || "",
    req.checkin,
    req.checkout,
    req.currency || "INR",
    req.countryCode || "IN",
    rooms,
    [...(req.providers || [])].sort().join(","),
    clientType,
    JSON.stringify(markupRules ?? []),
  ].join("~");

  return crypto.createHash("sha1").update(raw).digest("hex");
}

function newState(): FacetState {
  return {
    seen: new Set(),
    star: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    propertyType: {},
    mealType: {},
    amenity: {},
    provider: Object.fromEntries(supplierRegistry.all().map((s) => [s.code, 0])),
    location: {},
    prices: [],
    minPrice: Infinity,
    maxPrice: -Infinity,
    altDealCount: 0,
  };
}

/**
 * Folds one page of hotels into this search's running facets and returns the
 * cumulative view. Call with the geofenced, pre-filter hotel list.
 */
export function accumulateFacets(
  facetKey: string,
  pageHotels: any[],
  markupRules: MarkupRule[],
  nights: number,
): SearchFacets {
  const state = facetCache.get(facetKey) ?? newState();

  for (const hotel of pageHotels) {
    const id = hotel.hotelId;
    if (!id || state.seen.has(id)) continue;
    if (state.seen.size >= MAX_TRACKED_HOTELS) break;
    state.seen.add(id);

    const star = Math.round(Number(hotel.starRating || hotel.rating || 0));
    if (star >= 1 && star <= 5) state.star[star] = (state.star[star] || 0) + 1;

    const propType = getPropertyTypeLabel(hotel);
    if (propType) {
      state.propertyType[propType] = (state.propertyType[propType] || 0) + 1;
    }

    for (const meal of getMealTypes(hotel)) {
      state.mealType[meal] = (state.mealType[meal] || 0) + 1;
    }

    for (const amenity of hotel.amenities || []) {
      const normalized = titleCase(amenity);
      if (normalized) {
        state.amenity[normalized] = (state.amenity[normalized] || 0) + 1;
      }
    }

    if (hotel.source && hotel.source in state.provider) {
      state.provider[hotel.source] = (state.provider[hotel.source] || 0) + 1;
    }

    if (hotel.altDeal) state.altDealCount += 1;

    const price = hotelPrice(hotel, markupRules, nights);
    state.prices.push(price);
    if (price < state.minPrice) state.minPrice = price;
    if (price > state.maxPrice) state.maxPrice = price;

    const locality = extractLocality(hotel.address);
    if (locality) state.location[locality] = (state.location[locality] || 0) + 1;
  }

  // Re-setting refreshes both the TTL and the LRU position, so a search the user
  // is actively paging through never expires out from under them.
  facetCache.set(facetKey, state);

  return serialize(state);
}

function extractLocality(address: unknown): string | null {
  if (!address || typeof address !== "string") return null;
  const parts = address
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  for (const part of parts) {
    if (part.length > 3 && !/\d{5,}/.test(part) && !/^\d+$/.test(part) && !/india/i.test(part)) {
      return titleCase(part);
    }
  }
  return null;
}

function serialize(state: FacetState): SearchFacets {
  const minPrice = state.minPrice === Infinity ? 0 : round2(state.minPrice);
  const maxPrice = state.maxPrice === -Infinity ? 0 : round2(state.maxPrice);

  return {
    starRatingCounts: { ...state.star },
    propertyTypeCounts: { ...state.propertyType },
    mealTypeCounts: { ...state.mealType },
    amenityCounts: topN(state.amenity, MAX_AMENITIES),
    providerCounts: { ...state.provider },
    minPrice,
    maxPrice,
    topLocations: Object.entries(state.location)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_LOCATIONS)
      .map(([name, count]) => ({ name, count })),
    priceBuckets: buildPriceBuckets(state.prices, minPrice, maxPrice),
    totalHotels: state.seen.size,
    altDealCount: state.altDealCount,
  };
}

function topN(counts: Record<string, number>, n: number): Record<string, number> {
  const entries = Object.entries(counts);
  if (entries.length <= n) return { ...counts };
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, n));
}

/**
 * Equal-width price ranges over the observed span, each with an exact count.
 * The last bucket's upper bound is the observed max so the priciest hotel always
 * lands inside a bucket rather than one cent past the final edge.
 */
function buildPriceBuckets(
  prices: number[],
  min: number,
  max: number,
): PriceBucket[] {
  if (prices.length === 0) return [];
  if (max <= min) return [{ min, max, count: prices.length }];

  const width = (max - min) / PRICE_BUCKET_COUNT;
  const buckets: PriceBucket[] = Array.from(
    { length: PRICE_BUCKET_COUNT },
    (_, i) => ({
      min: round2(min + i * width),
      max: round2(i === PRICE_BUCKET_COUNT - 1 ? max : min + (i + 1) * width),
      count: 0,
    }),
  );

  for (const price of prices) {
    const idx = Math.min(
      PRICE_BUCKET_COUNT - 1,
      Math.max(0, Math.floor((price - min) / width)),
    );
    buckets[idx].count += 1;
  }

  return buckets;
}

/** Facets for a search that never ran (invalid input). Touches no cache. */
export function emptyFacets(): SearchFacets {
  return serialize(newState());
}
