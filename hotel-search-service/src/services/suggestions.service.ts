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
import { boundedEditDistance } from "../utils/text";
import { isMongoReady, withTimeout } from "../utils/mongoReady";
import { matchAliasPrefixes, resolveCityAlias } from "../data/cityAliases";
import {
  candidateCountries,
  fuzzyCountries,
  getStatesOfCountry,
  candidateCities,
  candidateStates,
  fuzzyCities,
  fuzzyStates,
  getCitiesOfCountry,
  getCitiesOfState,
  getCountryName,
  getStateName,
  normalize,
  tokenize,
  scoreName,
  NO_MATCH,
  SCORE_EXACT,
  SCORE_WORD_PREFIX,
  SCORE_PREFIX,
  SCORE_FUZZY,
  type CountryEntry,
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
 * was actually reaching for. Increased from 2→4 so international destinations
 * get enough slots when the user is clearly searching abroad.
 */
const MAX_FOREIGN_CITIES = 4;

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

/**
 * The only countries allowed to appear as a destination row.
 *
 * "India" is not a place you book a hotel in — MakeMyTrip and every other OTA
 * resolve a country query to its cities, never to the country itself. The
 * exceptions are small nation-states that a traveller genuinely treats as one
 * destination: you stay "in the Maldives", not in a named Maldivian city.
 *
 * Membership is about how the place is *booked*, not its size on a map, so this
 * stays a hand-kept list rather than anything derived from the dataset.
 */
const DESTINATION_COUNTRIES = new Set([
  "MV", // Maldives
  "SG", // Singapore
  "MU", // Mauritius
  "SC", // Seychelles
  "FJ", // Fiji
  "BB", // Barbados
  "AG", // Antigua and Barbuda
  "AW", // Aruba
  "BS", // Bahamas
  "MT", // Malta
  "CY", // Cyprus
  "BH", // Bahrain
  "QA", // Qatar
  "BN", // Brunei
  "BT", // Bhutan
  "MC", // Monaco
  "AD", // Andorra
  "LI", // Liechtenstein
  "SM", // San Marino
  "HK", // Hong Kong
  "MO", // Macau
]);

function matchCountries(queryLower: string, queryTokens: string[]): Array<Scored<CountryEntry>> {
  const matches: Array<Scored<CountryEntry>> = [];
  const seen = new Set<CountryEntry>();

  for (const entry of candidateCountries(queryTokens)) {
    if (!DESTINATION_COUNTRIES.has(entry.isoCode)) continue;
    const score = scoreName(entry.nameLower, entry.tokens, queryLower, queryTokens);
    if (score !== NO_MATCH) {
      matches.push({ entry, score });
      seen.add(entry);
    }
  }

  if (matches.length < 3) {
    for (const { entry, dist } of fuzzyCountries(queryLower)) {
      if (!DESTINATION_COUNTRIES.has(entry.isoCode)) continue;
      if (!seen.has(entry)) matches.push({ entry, score: SCORE_FUZZY + dist });
    }
  }

  return matches;
}

/**
 * True when the query is reaching for a country that we refuse to list.
 *
 * Used only to suppress the synthetic "Search all hotels in X" row: typing
 * "india" must not produce a country destination through the back door after
 * matchCountries has already declined to offer one.
 */
function isNonDestinationCountryQuery(queryLower: string, queryTokens: string[]): boolean {
  for (const entry of candidateCountries(queryTokens)) {
    if (DESTINATION_COUNTRIES.has(entry.isoCode)) continue;
    if (entry.nameLower.startsWith(queryLower)) return true;
  }
  return false;
}

function matchStates(queryLower: string, queryTokens: string[]): Array<Scored<StateEntry>> {
  const matches: Array<Scored<StateEntry>> = [];
  const seen = new Set<StateEntry>();

  for (const entry of candidateStates(queryTokens)) {
    const score = scoreName(entry.nameLower, entry.tokens, queryLower, queryTokens);
    if (score !== NO_MATCH) {
      matches.push({ entry, score });
      seen.add(entry);
    }
  }

  if (matches.length < 3) {
    for (const { entry, dist } of fuzzyStates(queryLower)) {
      if (!seen.has(entry)) matches.push({ entry, score: SCORE_FUZZY + dist });
    }
  }

  return matches;
}

/**
 * Destinations reached through a partly-typed alias — "bom" → Mumbai.
 *
 * The canonical name is looked up in the index and scored against the *alias*,
 * not against the canonical name: "bom" is a prefix of "bombay", so Mumbai
 * ranks as though the city were literally named Bombay. That keeps aliased and
 * real matches comparable in one ranking pass instead of bolting alias rows on
 * at the top.
 *
 * A part-typed alias scores as a word prefix, never a mid-word one. Anything
 * weaker loses to foreign micro-towns sharing the same opening letters — "bom"
 * put Bom Lugar and Bom Jesus above Mumbai, and "bang" buried Bengaluru under
 * Bang Na entirely. At equal score the home-country tiebreak settles it.
 */
function matchAliasedPlaces(typedLower: string): {
  states: Array<Scored<StateEntry>>;
  cities: Array<Scored<CityEntry>>;
} {
  const states: Array<Scored<StateEntry>> = [];
  const cities: Array<Scored<CityEntry>> = [];

  for (const { alias, canonical, kind, countryCode } of matchAliasPrefixes(typedLower)) {
    const score = alias === typedLower ? SCORE_EXACT : SCORE_WORD_PREFIX;
    const canonicalLower = normalize(canonical);
    const canonicalTokens = tokenize(canonical);

    if (kind === "state") {
      for (const entry of candidateStates(canonicalTokens)) {
        if (entry.countryCode === HOME_COUNTRY && entry.nameLower === canonicalLower) {
          states.push({ entry, score });
          break;
        }
      }
      continue;
    }

    // International alias: match against the specific country code provided.
    if (countryCode) {
      for (const entry of candidateCities(canonicalTokens)) {
        if (entry.countryCode === countryCode && entry.nameLower === canonicalLower) {
          cities.push({ entry, score });
          break;
        }
      }
      continue;
    }

    // Home-country alias (legacy behaviour).
    for (const entry of candidateCities(canonicalTokens)) {
      if (entry.countryCode === HOME_COUNTRY && entry.nameLower === canonicalLower) {
        cities.push({ entry, score });
        break;
      }
    }
  }

  return { states, cities };
}

function matchCities(queryLower: string, queryTokens: string[]): Array<Scored<CityEntry>> {
  const matches: Array<Scored<CityEntry>> = [];
  const seen = new Set<CityEntry>();

  // If a country matches the query, expand it to its top cities
  for (const countryMatch of matchCountries(queryLower, queryTokens)) {
    const cities = getCitiesOfCountry(countryMatch.entry.isoCode);
    cities.sort((a, b) => a.name.length - b.name.length);
    for (const city of cities.slice(0, 5)) {
      if (!seen.has(city)) {
        // Cap the score at SCORE_PREFIX so they aren't dropped
        matches.push({ entry: city, score: Math.min(countryMatch.score, SCORE_PREFIX) });
        seen.add(city);
      }
    }
  }

  for (const entry of candidateCities(queryTokens)) {
    const score = scoreName(entry.nameLower, entry.tokens, queryLower, queryTokens);
    if (score !== NO_MATCH) {
      matches.push({ entry, score });
      seen.add(entry);
    }
  }

  if (matches.length < 3) {
    for (const { entry, dist } of fuzzyCities(queryLower)) {
      if (!seen.has(entry)) matches.push({ entry, score: SCORE_FUZZY + dist });
    }
  }

  return matches;
}

const POPULAR_GLOBAL_DESTINATIONS = new Set([
  "maldives", "goa", "dubai", "bali", "singapore", "manali", "jaipur",
  "bangkok", "phuket", "pattaya", "shimla", "kerala", "mumbai", "delhi",
  "bengaluru", "chennai", "hyderabad", "kolkata", "london", "paris", "new york"
]);

type Candidate =
  | { kind: "country"; score: number; entry: CountryEntry }
  | { kind: "state"; score: number; entry: StateEntry }
  | { kind: "city"; score: number; entry: CityEntry };

function buildDestinations(
  queryLower: string,
  countries: Array<Scored<CountryEntry>>,
  states: Array<Scored<StateEntry>>,
  cities: Array<Scored<CityEntry>>,
  curated: Map<string, Array<{ name: string; description: string; tag?: string }>>,
): Suggestion[] {
  const candidates: Candidate[] = [
    ...countries.map((c): Candidate => ({ kind: "country", score: c.score, entry: c.entry })),
    ...states.map((s): Candidate => ({ kind: "state", score: s.score, entry: s.entry })),
    ...cities.map((c): Candidate => ({ kind: "city", score: c.score, entry: c.entry })),
  ];

  candidates.sort((a, b) => {
    // Tier 0: Popular global destinations (Maldives, Goa, Dubai, Bali...) that match the query
    const aIsPopular = POPULAR_GLOBAL_DESTINATIONS.has(a.entry.nameLower) && a.entry.nameLower.startsWith(queryLower);
    const bIsPopular = POPULAR_GLOBAL_DESTINATIONS.has(b.entry.nameLower) && b.entry.nameLower.startsWith(queryLower);
    if (aIsPopular !== bIsPopular) return aIsPopular ? -1 : 1;

    if (a.score !== b.score) return a.score - b.score;

    const aHome = a.entry.countryCode === HOME_COUNTRY ? 0 : 1;
    const bHome = b.entry.countryCode === HOME_COUNTRY ? 0 : 1;
    if (aHome !== bHome) return aHome - bHome;

    // Closer length to query outranks longer strings
    return Math.abs(a.entry.name.length - queryLower.length) - Math.abs(b.entry.name.length - queryLower.length);
  });

  const destinations: Suggestion[] = [];
  const claimedStates = new Set<string>();
  const claimedNames = new Set<string>();

  for (const candidate of candidates) {
    if (destinations.length >= MAX_DESTINATIONS) break;

    const { entry, score, kind } = candidate;
    const isHome = entry.countryCode === HOME_COUNTRY;
    const isPopularGlobal = POPULAR_GLOBAL_DESTINATIONS.has(entry.nameLower) || entry.nameLower.startsWith(queryLower);

    if (!isHome && !isPopularGlobal && score > SCORE_PREFIX) continue;
    if (claimedNames.has(entry.nameLower)) continue;

    if (kind === "city") {
      // The parent state is already listed and searching it covers this city.
      if (claimedStates.has(`${entry.countryCode}::${entry.stateCode}`)) continue;
    }

    claimedNames.add(entry.nameLower);

    const countryName = getCountryName(entry.countryCode);

    if (kind === "country") {
      destinations.push({
        id: `COUNTRY:${entry.isoCode}`,
        destCode: "",
        destName: entry.name,
        label: entry.name,
        name: entry.name,
        type: "city",
        source: "GEO",
        subtitle: `Country / Destination`,
        subSuggestions: [],
      });
      continue;
    }

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
 * A hotel row, exactly the fields ranking needs.
 *
 * `searchTokens` covers the hotel name *and* its city, which is what lets
 * "taj mumbai" find the Taj Mahal Palace. Ranking re-derives the name's own
 * tokens so it can tell a name match from a city match.
 */
interface HotelRow {
  tjHotelId: string;
  name: string;
  cityName?: string;
  starRating?: number;
}

/**
 * A one-character prefix ("t") spans hundreds of thousands of index keys and
 * cannot say anything useful about a hotel. Destinations still autocomplete at
 * two characters — they are matched in memory, where breadth is free.
 */
const HOTEL_MIN_TOKEN_LENGTH = 3;

/**
 * The pool that ranking chooses from.
 *
 * MongoDB has no way to sort by relevance here, so `limit(MAX_HOTELS)` at the
 * database returned the first six rows in *index order* — token alphabetically,
 * then insertion order. "taj" surfaced the six oldest hotels with a token
 * starting "taj", and the Taj Mahal Palace appeared only by luck. Pulling a
 * bounded pool and ordering it here costs one extra page of documents and is
 * what makes the first row the one the traveller meant.
 */
const HOTEL_CANDIDATE_LIMIT = 200;

/** Typo recovery reaches wider, because the exact prefix already found nothing. */
const FUZZY_CANDIDATE_LIMIT = 300;
/** "raddison" → "rad", which still reaches "Radisson". Typos after the third
 *  character are recoverable; one in the first three is not, exactly as for cities. */
const FUZZY_PREFIX_LENGTH = 3;
const FUZZY_MIN_QUERY_LENGTH = 4;

/**
 * Match quality, lowest wins. A hotel matched only through its *city* token
 * never earns a row: "mumbai" is a destination query, and answering it with six
 * arbitrary Mumbai properties under a "Hotels" heading is noise.
 */
const HOTEL_EXACT = 0;
const HOTEL_NAME_PREFIX = 1;
const HOTEL_ALL_TOKENS_IN_NAME = 2;
const HOTEL_NAME_AND_CITY = 3;

interface RankedHotel {
  row: HotelRow;
  tier: number;
  /** Query tokens matching a name token outright, not merely prefixing it.
   *  Separates "Taj Mahal Palace" (token "taj") from "Tajpur Lodge". */
  exactTokenHits: number;
  /** Edit distance, for the fuzzy pass only. Zero everywhere else. */
  distance: number;
}

function scoreHotel(
  nameLower: string,
  nameTokens: string[],
  queryLower: string,
  queryTokens: string[],
): { tier: number; exactTokenHits: number } | null {
  if (nameLower === queryLower) return { tier: HOTEL_EXACT, exactTokenHits: queryTokens.length };

  // The prefix must land on a word boundary. Without that test "taj" scores
  // "Tajpur Lodge" as a name prefix and floats it above "The Taj Mahal Palace",
  // which only ever matches at token level.
  if (nameLower.startsWith(queryLower) && !/[a-z0-9]/.test(nameLower[queryLower.length] ?? "")) {
    return { tier: HOTEL_NAME_PREFIX, exactTokenHits: queryTokens.length };
  }

  // Note: this must be a token-prefix test, not a whole-name prefix test. Hotel
  // names lead with "The", "Hotel", "ITC" far more often than city names do, so
  // "taj" has to reach the Taj inside "The Taj Mahal Palace".
  let hitsName = 0;
  let exactTokenHits = 0;
  for (const qt of queryTokens) {
    if (nameTokens.some((nt) => nt === qt)) {
      hitsName++;
      exactTokenHits++;
    } else if (nameTokens.some((nt) => nt.startsWith(qt))) {
      hitsName++;
    }
  }

  if (hitsName === 0) return null; // city-only match
  const tier = hitsName === queryTokens.length ? HOTEL_ALL_TOKENS_IN_NAME : HOTEL_NAME_AND_CITY;
  return { tier, exactTokenHits };
}

/** Better first. Ties broken toward the property a traveller is likelier to mean. */
function compareRanked(a: RankedHotel, b: RankedHotel): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.distance !== b.distance) return a.distance - b.distance;
  if (a.exactTokenHits !== b.exactTokenHits) return b.exactTokenHits - a.exactTokenHits;

  const aStars = a.row.starRating ?? 0;
  const bStars = b.row.starRating ?? 0;
  if (aStars !== bStars) return bStars - aStars;

  // A shorter name is the more canonical one ("Taj Mahal Palace" over
  // "Taj Mahal Palace Annexe Wing"). Name is the final, deterministic tiebreak.
  if (a.row.name.length !== b.row.name.length) return a.row.name.length - b.row.name.length;
  return a.row.name.localeCompare(b.row.name);
}

const escapeRegex = (t: string) => t.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

/**
 * Anchoring each token at `^` lets MongoDB walk the `searchTokens` multikey
 * index. The original `{ name: /taj/i }` could only be answered by scanning all
 * ~1.6M documents.
 */
async function fetchHotelRows(tokenSets: string[][], limit: number): Promise<HotelRow[]> {
  const { HotelModel } = require("../models/Hotel.model");

  // Every token must prefix-match some token of the hotel. Suppliers store their
  // own spelling of a city ("mysore"), which need not be the canonical one
  // ("mysuru"), so an aliased query searches for both.
  const clause = (tokens: string[]) => {
    const parts = tokens.map((t) => ({ searchTokens: { $regex: `^${escapeRegex(t)}` } }));
    return parts.length === 1 ? parts[0] : { $and: parts };
  };

  const filter = tokenSets.length === 1 ? clause(tokenSets[0]) : { $or: tokenSets.map(clause) };

  return HotelModel.find(filter)
    .select("tjHotelId name cityName starRating")
    .limit(limit)
    .maxTimeMS(DB_BUDGET_MS)
    .lean();
}

function rankStrict(rows: HotelRow[], tokenSets: string[][]): RankedHotel[] {
  const ranked: RankedHotel[] = [];

  for (const row of rows) {
    const nameLower = normalize(row.name ?? "");
    const nameTokens = tokenize(row.name ?? "");

    // An aliased query carries two spellings ("mysuru", "mysore"). A hotel need
    // only match one of them; keep whichever scores best.
    let best: { tier: number; exactTokenHits: number } | null = null;
    for (const queryTokens of tokenSets) {
      const scored = scoreHotel(nameLower, nameTokens, queryTokens.join(" "), queryTokens);
      if (!scored) continue;
      const better =
        !best ||
        scored.tier < best.tier ||
        (scored.tier === best.tier && scored.exactTokenHits > best.exactTokenHits);
      if (better) best = scored;
    }

    if (best) ranked.push({ row, tier: best.tier, exactTokenHits: best.exactTokenHits, distance: 0 });
  }

  return ranked.sort(compareRanked);
}

/** One edit allowed for short words, two once there is room for a real typo. */
function editBudget(token: string): number {
  return token.length >= 7 ? 2 : 1;
}

/**
 * "raddison" → Radisson, "tak mahal" → Taj Mahal.
 *
 * Runs only when exact prefix matching found nothing, so the extra round trip
 * never touches the common path. Every query token must land — within its edit
 * budget — on some *name* token; a query token that only reaches a city token is
 * ignored, exactly as in the strict pass. A hotel keeps a row only when all of
 * its query tokens are accounted for, and its distance is the total of them, so
 * the single-typo match ranks above the double.
 */
function rankFuzzy(rows: HotelRow[], queryTokens: string[]): RankedHotel[] {
  const budgets = queryTokens.map(editBudget);
  const ranked: RankedHotel[] = [];

  for (const row of rows) {
    const nameTokens = tokenize(row.name ?? "");
    if (!nameTokens.length) continue;

    let total = 0;
    let matchedAll = true;
    for (let i = 0; i < queryTokens.length; i++) {
      const qt = queryTokens[i];
      const budget = budgets[i];
      let best = budget + 1;
      for (const nt of nameTokens) {
        // A correct prefix is a zero-cost match: "taj" is not a typo of "taj".
        if (nt.startsWith(qt)) {
          best = 0;
          break;
        }
        const d = boundedEditDistance(qt, nt, budget);
        if (d < best) best = d;
      }
      if (best > budget) {
        matchedAll = false;
        break;
      }
      total += best;
    }

    if (matchedAll) ranked.push({ row, tier: HOTEL_NAME_AND_CITY + 1, exactTokenHits: 0, distance: total });
  }

  return ranked.sort(compareRanked);
}

function toSuggestion(row: HotelRow): Suggestion {
  const hotelId = row.tjHotelId.startsWith("TJ:") ? row.tjHotelId : `TJ:${row.tjHotelId}`;
  const city = titleCase(row.cityName ?? "");
  return {
    id: hotelId,
    hotelId,
    destCode: "",
    destName: row.name,
    label: city ? `${row.name}, ${city}` : row.name,
    name: row.name,
    type: "hotel",
    source: "TJ",
    city,
    subtitle: city ? `Hotel in ${city}` : "Hotel",
  };
}

async function queryHotels(tokenSets: string[][]): Promise<Suggestion[]> {
  const rows = await fetchHotelRows(tokenSets, HOTEL_CANDIDATE_LIMIT);
  let ranked = rankStrict(rows, tokenSets);

  if (!ranked.length) {
    // Anchor the recovery on the query's longest token, not its first. The typo
    // can sit anywhere ("tak mahal"), and the longest token is both the most
    // likely to be spelled right and the most selective to fetch on. One extra
    // query, only ever on a query the strict pass could not answer at all.
    const queryTokens = tokenSets[0];
    const anchor = queryTokens.reduce((a, b) => (b.length > a.length ? b : a));
    if (anchor.length >= FUZZY_MIN_QUERY_LENGTH) {
      const prefix = [[anchor.slice(0, FUZZY_PREFIX_LENGTH)]];
      const candidates = await fetchHotelRows(prefix, FUZZY_CANDIDATE_LIMIT);
      ranked = rankFuzzy(candidates, queryTokens);
    }
  }

  return ranked.slice(0, MAX_HOTELS).map((r) => toSuggestion(r.row));
}

type HotelLookup = {
  hotels: Suggestion[];
  degraded: boolean;
  reason?: "disconnected" | "slow";
};

/** Never throws, never outlives its budget. Reports why it degraded, if it did. */
async function matchHotels(tokenSets: string[][]): Promise<HotelLookup> {
  // Drop tokens too short to index usefully, then any set left empty by that.
  const sets = tokenSets
    .map((s) => s.filter((t) => t.length >= HOTEL_MIN_TOKEN_LENGTH))
    .filter((s) => s.length);
  if (!sets.length) return { hotels: [], degraded: false };
  if (!isMongoReady()) return { hotels: [], degraded: true, reason: "disconnected" };

  // Two budgets' worth of ceiling: the fuzzy fallback issues a second query, and
  // only ever on a query the first one could not answer at all.
  const { value, timedOut } = await withTimeout<Suggestion[]>(
    queryHotels(sets),
    DB_BUDGET_MS * 2,
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

  // Alias hits are scored against the alias and merged into the same pool, so a
  // part-typed "bom" competes with real "bom…" cities rather than pre-empting them.
  const aliased = matchAliasedPlaces(typedLower);

  const destinations = buildDestinations(
    queryLower,
    matchCountries(queryLower, queryTokens),
    matchStates(queryLower, queryTokens),
    matchCities(queryLower, queryTokens),
    curated,
  );

  // Ensure that whatever destination string the user is typing (e.g., "Maldives", "Maldi", "Bali"),
  // a clean destination entry is ALWAYS positioned at #1 at the top of the list if an exact match isn't already #1.
  const hasExactDestination = destinations.some(
    (d) => normalize(d.name).startsWith(queryLower) || queryLower.startsWith(normalize(d.name))
  );
  if (
    !hasExactDestination &&
    rawQuery.trim().length >= 2 &&
    !isNonDestinationCountryQuery(queryLower, queryTokens)
  ) {
    const cleanTitle = titleCase(rawQuery.trim());
    destinations.unshift({
      id: `CITY:${cleanTitle}`,
      destCode: "",
      destName: cleanTitle,
      label: cleanTitle,
      name: cleanTitle,
      type: "city",
      source: "GEO",
      subtitle: `Search all hotels in ${cleanTitle}`,
      subSuggestions: [],
    });
  }

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
