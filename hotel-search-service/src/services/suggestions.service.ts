/**
 * Destination + hotel autocomplete.
 *
 * Two properties matter here and they pull against each other:
 *
 *   1. Speed. Every keystroke hits this. All static work is precomputed in
 *      suggestionIndex; results are memoised in an LRU.
 *   2. One place, one row. A traveller searching "goa" must see a single "Goa"
 *      that searches the whole state — not Goa plus North Goa, South Goa,
 *      Goa Velha and a homonym in the Philippines.
 */
import { LruCache } from "../utils/lruCache";
import { isMongoReady, withTimeout } from "../utils/mongoReady";
import { resolveCityAlias } from "../data/cityAliases";
import {
  candidateCities,
  candidateStates,
  fuzzyCities,
  getCitiesOfState,
  getCountryName,
  getStateName,
  normalize,
  tokenize,
  scoreName,
  NO_MATCH,
  SCORE_PREFIX,
  SCORE_FUZZY,
  type CityEntry,
  type StateEntry,
} from "./suggestionIndex";

export interface Suggestion {
  id: string;
  destCode: string;
  destName: string;
  label: string;
  name: string;
  type: "city" | "hotel";
  source: "GEO" | "TJ";
  subtitle: string;
  hotelId?: string;
  city?: string;
  subSuggestions?: Array<{
    id: string;
    name: string;
    destCode: string;
    subtitle: string;
    tag?: string;
  }>;
}

/** India-first ranking. Override per-deployment without touching this file. */
const HOME_COUNTRY = process.env.HOME_COUNTRY_CODE || "IN";

const MAX_DESTINATIONS = 5;
const MAX_HOTELS = 6;
const MAX_SUB_SUGGESTIONS = 5;
const MIN_QUERY_LENGTH = 2;

/**
 * Without a cap, a query like "taj" fills every slot with obscure prefix
 * matches (Tajao, Tajimi, Tajiri, Tajueco) and buries the Taj hotels the user
 * was actually reaching for.
 */
const MAX_FOREIGN_CITIES = 2;

/** "goa" → "Goa", "north goa" → "North Goa". The sync stores cityName lowercased. */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Budget for the database reads on the keystroke path.
 *
 * Destinations are served from memory and always returned. Hotel rows and
 * curated areas are enrichment: if the database is slow or down, the user gets
 * destinations instantly instead of waiting on mongoose's 10s buffering timeout.
 */
const DB_BUDGET_MS = Number(process.env.SUGGEST_DB_BUDGET_MS || 150);

type AreaMap = Map<string, Array<{ name: string; description: string; tag?: string }>>;

const suggestionCache = new LruCache<Suggestion[]>(500, 5 * 60 * 1000);

/** Popular areas change rarely; one DB read per 10 minutes is plenty. */
let popularAreasCache: { byCity: AreaMap; fetchedAt: number } | null = null;
const POPULAR_AREAS_TTL_MS = 10 * 60 * 1000;
/** Retry sooner after a failure, but not on every keystroke. */
const POPULAR_AREAS_RETRY_MS = 30 * 1000;

async function loadPopularAreas(): Promise<AreaMap> {
  const byCity: AreaMap = new Map();
  const { PopularAreaModel } = require("../models/PopularArea.model");
  const docs = await PopularAreaModel.find().maxTimeMS(DB_BUDGET_MS).lean();
  for (const doc of docs) {
    const key = normalize(doc.cityKey);
    const list = byCity.get(key) ?? [];
    list.push({ name: doc.name, description: doc.description, tag: doc.tag || undefined });
    byCity.set(key, list);
  }
  return byCity;
}

async function getPopularAreasByCity(): Promise<AreaMap> {
  if (popularAreasCache) {
    const age = Date.now() - popularAreasCache.fetchedAt;
    const ttl = popularAreasCache.byCity.size ? POPULAR_AREAS_TTL_MS : POPULAR_AREAS_RETRY_MS;
    if (age < ttl) return popularAreasCache.byCity;
  }

  if (!isMongoReady()) {
    popularAreasCache = { byCity: new Map(), fetchedAt: Date.now() };
    return popularAreasCache.byCity;
  }

  const { value } = await withTimeout<AreaMap>(
    loadPopularAreas(),
    DB_BUDGET_MS,
    new Map(),
    "popular areas",
  );

  popularAreasCache = { byCity: value, fetchedAt: Date.now() };
  return value;
}

export function invalidateSuggestionCache(): void {
  suggestionCache.clear();
  popularAreasCache = null;
}

/** Common misspellings that the edit-distance pass alone would not recover. */
function applyTypoFixes(query: string): string {
  return query.replace(/anaya/gi, "ananya");
}

/**
 * "mysore" → "mysuru", "trivandrum" → "thiruvananthapuram".
 *
 * Aliases are resolved before matching so the traveller can type the name they
 * actually say, while the dropdown and the downstream geocoder both see the
 * canonical name the dataset knows.
 */
function canonicalize(queryLower: string): string {
  const canonical = resolveCityAlias(queryLower);
  return canonical ? normalize(canonical) : queryLower;
}

interface Scored<T> {
  entry: T;
  score: number;
}


/**
 * Sub-areas shown beneath a destination.
 *
 * Curated rows from the database are used wherever they exist. The city-list
 * fallback only applies to a *state*, whose cities genuinely sit inside it —
 * applying it to a city would list that city's siblings (Agra as a "sub-area"
 * of Tajpur), so a city without curated areas simply gets none.
 */
function buildSubSuggestions(
  destinationName: string,
  kind: "state" | "city",
  countryCode: string,
  stateCode: string,
  curated: Map<string, Array<{ name: string; description: string; tag?: string }>>,
): Suggestion["subSuggestions"] {
  const parentName = normalize(destinationName);
  const areas = curated.get(parentName.split(/[\s,]/)[0]);

  if (areas?.length) {
    return areas.slice(0, MAX_SUB_SUGGESTIONS).map((area) => ({
      id: `AREA:${area.name}:${destinationName}`,
      name: area.name,
      destCode: "",
      subtitle: area.description || `in ${destinationName}`,
      tag: area.tag,
    }));
  }

  if (kind !== "state") return [];

  // Skip the state's own administrative districts ("North Goa", "South Goa"),
  // which read as duplicates of the parent row rather than as places to stay.
  return getCitiesOfState(countryCode, stateCode)
    .filter((c) => !c.nameLower.includes(parentName))
    .slice(0, MAX_SUB_SUGGESTIONS)
    .map((c, i) => ({
      id: `CITY:${c.name}:${stateCode}:${countryCode}`,
      name: c.name,
      destCode: "",
      subtitle: `in ${destinationName}`,
      tag: i === 0 ? "POPULAR" : i === 1 ? "TRENDING" : undefined,
    }));
}

function matchStates(queryLower: string, queryTokens: string[]): Array<Scored<StateEntry>> {
  const matches: Array<Scored<StateEntry>> = [];
  for (const entry of candidateStates(queryTokens)) {
    const score = scoreName(entry.nameLower, entry.tokens, queryLower, queryTokens);
    if (score !== NO_MATCH) matches.push({ entry, score });
  }
  return matches;
}

function matchCities(queryLower: string, queryTokens: string[]): Array<Scored<CityEntry>> {
  const matches: Array<Scored<CityEntry>> = [];
  const seen = new Set<CityEntry>();

  for (const entry of candidateCities(queryTokens)) {
    const score = scoreName(entry.nameLower, entry.tokens, queryLower, queryTokens);
    if (score !== NO_MATCH) {
      matches.push({ entry, score });
      seen.add(entry);
    }
  }

  if (matches.length < 3) {
    for (const entry of fuzzyCities(queryLower)) {
      if (!seen.has(entry)) matches.push({ entry, score: SCORE_FUZZY });
    }
  }

  return matches;
}

/**
 * Collapse the result set so each place appears exactly once, ranked home-first.
 *
 * A matched state claims its entire territory: every city inside it folds into
 * the parent row, because selecting the state already searches the whole region.
 * That is what turns Goa / North Goa / South Goa / Goa Velha into a single "Goa".
 * A matched name claims its spelling, so a second "Goa" or "Delhi" abroad is
 * dropped rather than shown as a confusing near-duplicate.
 *
 * States and cities are ranked in one list rather than one after the other, so a
 * foreign state can never outrank a home-country city.
 */
type Candidate =
  | { kind: "state"; score: number; entry: StateEntry }
  | { kind: "city"; score: number; entry: CityEntry };

function buildDestinations(
  queryLower: string,
  states: Array<Scored<StateEntry>>,
  cities: Array<Scored<CityEntry>>,
  curated: Map<string, Array<{ name: string; description: string; tag?: string }>>,
): Suggestion[] {
  /**
   * The query names a home-country place outright ("goa", "delhi"). Anything
   * foreign that merely shares a prefix ("Goascoran", "Delhi Hills") is noise,
   * so it is dropped. When the query resolves nowhere at home ("new", "dubai")
   * this stays false and foreign places compete normally.
   */
  const resolvedAtHome =
    states.some((s) => s.entry.countryCode === HOME_COUNTRY && s.entry.nameLower === queryLower) ||
    cities.some((c) => c.entry.countryCode === HOME_COUNTRY && c.entry.nameLower === queryLower);

  const candidates: Candidate[] = [
    ...states.map((s): Candidate => ({ kind: "state", score: s.score, entry: s.entry })),
    ...cities.map((c): Candidate => ({ kind: "city", score: c.score, entry: c.entry })),
  ];

  candidates.sort((a, b) => {
    const aHome = a.entry.countryCode === HOME_COUNTRY ? 0 : 1;
    const bHome = b.entry.countryCode === HOME_COUNTRY ? 0 : 1;
    if (aHome !== bHome) return aHome - bHome;
    if (a.score !== b.score) return a.score - b.score;
    // A state outranks a city of equal standing: it is the broader search.
    const aKind = a.kind === "state" ? 0 : 1;
    const bKind = b.kind === "state" ? 0 : 1;
    if (aKind !== bKind) return aKind - bKind;
    return a.entry.name.length - b.entry.name.length;
  });

  const hasHomeMatch = candidates.some((c) => c.entry.countryCode === HOME_COUNTRY);
  // With nothing at home ("dubai", "new york") foreign places are the answer, so
  // let them use every slot. Otherwise they are capped to leave room for hotels.
  const foreignBudget = hasHomeMatch ? MAX_FOREIGN_CITIES : MAX_DESTINATIONS;

  const destinations: Suggestion[] = [];
  const claimedStates = new Set<string>();
  const claimedNames = new Set<string>();
  let foreignUsed = 0;

  for (const candidate of candidates) {
    if (destinations.length >= MAX_DESTINATIONS) break;

    const { entry, score, kind } = candidate;
    const isHome = entry.countryCode === HOME_COUNTRY;

    if (!isHome && resolvedAtHome) continue;
    // A foreign place earns a row only on a strong match, never on a typo guess.
    if (!isHome && score > SCORE_PREFIX) continue;
    if (!isHome && foreignUsed >= foreignBudget) continue;
    if (claimedNames.has(entry.nameLower)) continue;

    if (kind === "city") {
      // The parent state is already listed and searching it covers this city.
      if (claimedStates.has(`${entry.countryCode}::${entry.stateCode}`)) continue;
    }

    claimedNames.add(entry.nameLower);
    if (!isHome) foreignUsed++;

    const countryName = getCountryName(entry.countryCode);

    if (kind === "state") {
      claimedStates.add(`${entry.countryCode}::${entry.isoCode}`);
      destinations.push({
        // destCode stays empty on purpose: the backend then text-resolves the name
        // through OpenCage, which returns the *state* bounding box. That is what
        // makes "Goa" search all of Goa instead of a single point.
        id: `STATE:${entry.countryCode}:${entry.isoCode}`,
        destCode: "",
        destName: entry.name,
        label: entry.name,
        name: entry.name,
        type: "city",
        source: "GEO",
        subtitle: `Region in ${countryName}`,
        subSuggestions: buildSubSuggestions(
          entry.name,
          "state",
          entry.countryCode,
          entry.isoCode,
          curated,
        ),
      });
      continue;
    }

    const stateName = getStateName(entry.countryCode, entry.stateCode);
    const subtitle =
      stateName && stateName !== entry.name
        ? `City in ${stateName}, ${countryName}`
        : `City in ${countryName}`;

    destinations.push({
      // destCode stays empty for cities too, for the same reason it is empty for
      // states: `country-state-city` coordinates are unreliable. It places Mysuru
      // at 12.23,76.42 — about 31km from the real city, in open farmland — and a
      // GEO token built from that makes the search look 31km off target with a
      // 5km radius, returning nothing. Text resolution goes through OpenCage and
      // the GeoCache, which place Mysuru correctly with a 24.9km radius.
      //
      // This also costs nothing: searchHotels geocoded the token *and* the text
      // anyway, in order to cross-check them. One geocode now, not two.
      id: `CITY:${entry.countryCode}:${entry.stateCode}:${entry.name}`,
      destCode: "",
      destName: entry.name,
      label: entry.name,
      name: entry.name,
      type: "city",
      source: "GEO",
      subtitle,
      subSuggestions: buildSubSuggestions(
        entry.name,
        "city",
        entry.countryCode,
        entry.stateCode,
        curated,
      ),
    });
  }

  return destinations;
}

/**
 * Hotel name matches, resolved through the `searchTokens` multikey index.
 *
 * The previous implementation used an unanchored case-insensitive regex, which
 * forced a collection scan across ~1.6M documents on every keystroke. Anchoring
 * each token at `^` lets MongoDB walk the index instead.
 */
async function queryHotels(tokenSets: string[][]): Promise<Suggestion[]> {
  const { HotelModel } = require("../models/Hotel.model");

  const escape = (t: string) => t.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

  // Every token must prefix-match some token of the hotel. Suppliers store their
  // own spelling of a city ("mysore"), which need not be the canonical one
  // ("mysuru"), so an aliased query searches for both.
  const clause = (tokens: string[]) => {
    const parts = tokens.map((t) => ({ searchTokens: { $regex: `^${escape(t)}` } }));
    return parts.length === 1 ? parts[0] : { $and: parts };
  };

  const filter = tokenSets.length === 1 ? clause(tokenSets[0]) : { $or: tokenSets.map(clause) };

  const hotels = await HotelModel.find(filter)
    .select("tjHotelId name cityName")
    .limit(MAX_HOTELS)
    .maxTimeMS(DB_BUDGET_MS)
    .lean();

  return hotels.map((h: any) => {
    const hotelId = h.tjHotelId.startsWith("TJ:") ? h.tjHotelId : `TJ:${h.tjHotelId}`;
    const city = titleCase(h.cityName ?? "");
    return {
      id: hotelId,
      hotelId,
      destCode: "",
      destName: h.name,
      label: `${h.name}, ${city}`,
      name: h.name,
      type: "hotel" as const,
      source: "TJ" as const,
      city,
      subtitle: `Hotel in ${city}`,
    };
  });
}

type HotelLookup = {
  hotels: Suggestion[];
  degraded: boolean;
  reason?: "disconnected" | "slow";
};

/** Never throws, never outlives DB_BUDGET_MS. Reports why it degraded, if it did. */
async function matchHotels(tokenSets: string[][]): Promise<HotelLookup> {
  const sets = tokenSets.filter((s) => s.length);
  if (!sets.length) return { hotels: [], degraded: false };
  if (!isMongoReady()) return { hotels: [], degraded: true, reason: "disconnected" };

  const { value, timedOut } = await withTimeout<Suggestion[]>(
    queryHotels(sets),
    DB_BUDGET_MS,
    [],
    `hotel lookup "${sets[0].join(" ")}"`,
  );
  return timedOut
    ? { hotels: value, degraded: true, reason: "slow" }
    : { hotels: value, degraded: false };
}

export async function getSuggestions(rawQuery: string): Promise<Suggestion[]> {
  if (!rawQuery || rawQuery.trim().length < MIN_QUERY_LENGTH) return [];

  const query = applyTypoFixes(rawQuery.trim());
  const typedLower = normalize(query);
  const cacheKey = typedLower;

  const cached = suggestionCache.get(cacheKey);
  if (cached) return cached;

  // Destinations match on the canonical name; hotels are searched under both the
  // canonical name and what the user actually typed.
  const queryLower = canonicalize(typedLower);
  const queryTokens = tokenize(queryLower);
  if (!queryTokens.length) return [];

  const typedTokens = tokenize(typedLower);
  const tokenSets =
    queryLower === typedLower ? [queryTokens] : [queryTokens, typedTokens];

  const startedAt = Date.now();

  // Both reads are independent, so issue them together rather than in series.
  const [curated, hotelResult] = await Promise.all([
    getPopularAreasByCity(),
    matchHotels(tokenSets),
  ]);

  const destinations = buildDestinations(
    queryLower,
    matchStates(queryLower, queryTokens),
    matchCities(queryLower, queryTokens),
    curated,
  );

  const results = [...destinations, ...hotelResult.hotels];

  // A result produced while the database was unreachable is missing its hotel
  // rows. Caching it for five minutes would outlive the outage and keep serving
  // an incomplete list long after Mongo recovered.
  if (!hotelResult.degraded) suggestionCache.set(cacheKey, results);

  const elapsed = Date.now() - startedAt;
  if (elapsed > 20 || hotelResult.degraded) {
    const why =
      hotelResult.reason === "disconnected"
        ? " (no hotel rows: MongoDB not connected)"
        : hotelResult.reason === "slow"
          ? " (no hotel rows: lookup exceeded budget — run `npm run backfill:tokens`)"
          : "";
    console.log(`[Suggest] "${query}" → ${results.length} results in ${elapsed}ms${why}`);
  }

  return results;
}
