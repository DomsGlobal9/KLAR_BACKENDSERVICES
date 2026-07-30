/**
 * Boot-time destination index for autocomplete.
 *
 * `country-state-city` ships ~148k cities and ~5k states. Scanning them per
 * request costs 150-330ms of synchronous CPU, which blocks the event loop and
 * starves every other request in this process (hotel search, hotel products).
 *
 * Everything derivable from that static dataset is therefore computed exactly
 * once, at boot, into prefix buckets. A lookup then touches only the bucket for
 * the query's first two characters — a few thousand entries at worst.
 */
import { City, State, Country } from "country-state-city";
import { boundedEditDistance, normalizeText, tokenizeText } from "../utils/text";

/**
 * Deliberately carries no coordinates.
 *
 * `country-state-city` latitudes and longitudes are unreliable — it places
 * Mysuru 27km from the real city, and 474 of its 4,242 Indian cities are stored
 * at two-decimal precision. Coordinates come from OpenCage (cross-checked
 * against our own hotel inventory to within ~2km), never from this dataset.
 * Omitting the fields makes that a compile-time guarantee rather than a
 * convention someone can forget.
 */

export interface CityEntry {
  name: string;
  nameLower: string;
  tokens: string[];
  countryCode: string;
  stateCode: string;
}

export interface StateEntry {
  name: string;
  nameLower: string;
  tokens: string[];
  isoCode: string;
  countryCode: string;
}

export interface CountryEntry {
  name: string;
  nameLower: string;
  tokens: string[];
  isoCode: string;
  countryCode: string;
}

interface SuggestionIndex {
  countryBuckets: Map<string, CountryEntry[]>;
  cityBuckets: Map<string, CityEntry[]>;
  stateBuckets: Map<string, StateEntry[]>;
  citiesByState: Map<string, CityEntry[]>;
  citiesByCountry: Map<string, CityEntry[]>;
  statesByCountry: Map<string, StateEntry[]>;
  citiesByFirstChar: Map<string, CityEntry[]>;
  statesByFirstChar: Map<string, StateEntry[]>;
  countriesByFirstChar: Map<string, CountryEntry[]>;
  countryNames: Map<string, string>;
  stateByCode: Map<string, StateEntry>;
  builtInMs: number;
  cityCount: number;
}


let index: SuggestionIndex | null = null;

/** Bucket key: first two characters, or the single character for 1-char tokens. */
function bucketKey(token: string): string {
  return token.length >= 2 ? token.slice(0, 2) : token;
}

/**
 * Re-exported so existing callers keep working. The definitions live in
 * utils/text because Hotel.model must tokenize identically and cannot import
 * this module (it would pull the whole country-state-city dataset into the
 * model layer).
 */
export const normalize = normalizeText;
export const tokenize = tokenizeText;

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/**
 * Index a place under the bucket of every token it contains, so "taj" finds
 * "The Taj Mahal Palace" and "goa" finds "Goa Velha" — without a full scan.
 */
function indexByTokens<T extends { tokens: string[] }>(
  buckets: Map<string, T[]>,
  entry: T,
): void {
  const seen = new Set<string>();
  for (const token of entry.tokens) {
    const key = bucketKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    push(buckets, key, entry);
  }
}

export function buildSuggestionIndex(): SuggestionIndex {
  if (index) return index;
  const startedAt = Date.now();

  const countryBuckets = new Map<string, CountryEntry[]>();
  const cityBuckets = new Map<string, CityEntry[]>();
  const stateBuckets = new Map<string, StateEntry[]>();
  const citiesByState = new Map<string, CityEntry[]>();
  const citiesByCountry = new Map<string, CityEntry[]>();
  const statesByCountry = new Map<string, StateEntry[]>();
  const citiesByFirstChar = new Map<string, CityEntry[]>();
  const statesByFirstChar = new Map<string, StateEntry[]>();
  const countriesByFirstChar = new Map<string, CountryEntry[]>();
  const countryNames = new Map<string, string>();
  const stateByCode = new Map<string, StateEntry>();

  for (const country of Country.getAllCountries()) {
    countryNames.set(country.isoCode, country.name);
    const nameLower = normalize(country.name);
    const entry: CountryEntry = {
      name: country.name,
      nameLower,
      tokens: tokenize(country.name),
      isoCode: country.isoCode,
      countryCode: country.isoCode,
    };
    indexByTokens(countryBuckets, entry);
    if (nameLower) push(countriesByFirstChar, nameLower[0], entry);
  }

  for (const raw of State.getAllStates()) {
    const nameLower = normalize(raw.name);
    const entry: StateEntry = {
      name: raw.name,
      nameLower,
      tokens: tokenize(raw.name),
      isoCode: raw.isoCode,
      countryCode: raw.countryCode,
    };
    indexByTokens(stateBuckets, entry);
    stateByCode.set(`${raw.countryCode}::${raw.isoCode}`, entry);
    push(statesByCountry, raw.countryCode, entry);
    if (nameLower) push(statesByFirstChar, nameLower[0], entry);
  }

  for (const raw of City.getAllCities()) {
    const nameLower = normalize(raw.name);
    const entry: CityEntry = {
      name: raw.name,
      nameLower,
      tokens: tokenize(raw.name),
      countryCode: raw.countryCode,
      stateCode: raw.stateCode,
    };
    indexByTokens(cityBuckets, entry);
    push(citiesByState, `${raw.countryCode}::${raw.stateCode}`, entry);
    push(citiesByCountry, raw.countryCode, entry);
    if (nameLower) push(citiesByFirstChar, nameLower[0], entry);
  }

  index = {
    countryBuckets,
    cityBuckets,
    stateBuckets,
    citiesByState,
    citiesByCountry,
    statesByCountry,
    citiesByFirstChar,
    statesByFirstChar,
    countriesByFirstChar,
    countryNames,
    stateByCode,
    builtInMs: Date.now() - startedAt,
    cityCount: City.getAllCities().length,
  };

  console.log(
    `[Suggest] Index built in ${index.builtInMs}ms — ${index.cityCount} cities, ` +
      `${cityBuckets.size} city buckets, ${stateBuckets.size} state buckets.`,
  );
  return index;
}

export function getSuggestionIndex(): SuggestionIndex {
  return index ?? buildSuggestionIndex();
}

export function getCountryName(code: string): string {
  return getSuggestionIndex().countryNames.get(code) ?? code;
}

export function getStateName(countryCode: string, stateCode: string): string {
  return (
    getSuggestionIndex().stateByCode.get(`${countryCode}::${stateCode}`)?.name ??
    stateCode
  );
}

export function getCitiesOfState(
  countryCode: string,
  stateCode: string,
): CityEntry[] {
  return getSuggestionIndex().citiesByState.get(`${countryCode}::${stateCode}`) ?? [];
}

export function getStatesOfCountry(countryCode: string): StateEntry[] {
  return getSuggestionIndex().statesByCountry.get(countryCode) ?? [];
}

export function getCitiesOfCountry(countryCode: string): CityEntry[] {
  return getSuggestionIndex().citiesByCountry.get(countryCode) ?? [];
}

/** Candidate places whose name contains a token starting with the query's first token. */
export function candidateCities(queryTokens: string[]): CityEntry[] {
  if (!queryTokens.length) return [];
  return getSuggestionIndex().cityBuckets.get(bucketKey(queryTokens[0])) ?? [];
}

export function candidateStates(queryTokens: string[]): StateEntry[] {
  if (!queryTokens.length) return [];
  return getSuggestionIndex().stateBuckets.get(bucketKey(queryTokens[0])) ?? [];
}

export function candidateCountries(queryTokens: string[]): CountryEntry[] {
  if (!queryTokens.length) return [];
  return getSuggestionIndex().countryBuckets.get(bucketKey(queryTokens[0])) ?? [];
}

/**
 * Match scores, lowest wins.
 *
 * A prefix landing on a word boundary beats one landing mid-word, so "new"
 * ranks "New Delhi" above "Newara". A multi-token query must match *every*
 * token as a token-prefix — otherwise "north goa" matches "North Delhi" on
 * "north" alone, which is how the old first-word-only rule produced its noise.
 */
export const SCORE_EXACT = 0;
export const SCORE_WORD_PREFIX = 1;
export const SCORE_PREFIX = 2;
export const SCORE_ALL_TOKENS = 3;
export const SCORE_FUZZY = 4;
export const NO_MATCH = 99;

export function scoreName(
  nameLower: string,
  nameTokens: string[],
  queryLower: string,
  queryTokens: string[],
): number {
  if (nameLower === queryLower) return SCORE_EXACT;

  if (nameLower.startsWith(queryLower)) {
    const nextChar = nameLower[queryLower.length];
    return /[a-z0-9]/.test(nextChar) ? SCORE_PREFIX : SCORE_WORD_PREFIX;
  }

  if (queryTokens.length > 1) {
    const everyTokenMatches = queryTokens.every((qt) =>
      nameTokens.some((nt) => nt.startsWith(qt)),
    );
    if (everyTokenMatches) return SCORE_ALL_TOKENS;
  }
  return NO_MATCH;
}

/** India-first ranking. Override per-deployment without touching this file. */
export const HOME_COUNTRY = process.env.HOME_COUNTRY_CODE || "IN";

/**
 * Typo tolerance, scanning only cities sharing the query's first letter.
 *
 * Home-country matches are allowed one extra edit and win ties, so "delih"
 * resolves to Delhi rather than Delph in England.
 */
export function fuzzyCities(queryLower: string): Array<{ entry: CityEntry; dist: number }> {
  const len = queryLower.length;
  if (len < 4) return []; // too short for a meaningful edit distance
  const max = len >= 7 ? 2 : 1;
  const homeMax = max + 1;

  const bucket = getSuggestionIndex().citiesByFirstChar.get(queryLower[0]) ?? [];
  const hits: Array<{ city: CityEntry; dist: number; home: boolean }> = [];

  for (const city of bucket) {
    const home = city.countryCode === HOME_COUNTRY;
    const limit = home ? homeMax : max;
    const name = city.nameLower;

    // Enforce prefix similarity: city must share at least first 3 characters for 3+ char queries.
    // Stops "maldi" (prefix "mal") from matching "mandi" (prefix "man") or "madhi" (prefix "mad").
    const prefixLen = Math.min(3, queryLower.length);
    if (!name.startsWith(queryLower.slice(0, prefixLen))) continue;

    if (name.length < len - limit || name.length > len + limit) continue;

    const dist = boundedEditDistance(queryLower, name, limit);
    if (dist <= limit) hits.push({ city, dist, home });
  }

  hits.sort((a, b) => {
    if (a.home !== b.home) return a.home ? -1 : 1;
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.city.name.length - b.city.name.length;
  });
  return hits.slice(0, 5).map((h) => ({ entry: h.city, dist: h.dist }));
}

export function fuzzyStates(queryLower: string): Array<{ entry: StateEntry; dist: number }> {
  const len = queryLower.length;
  if (len < 4) return []; // too short for a meaningful edit distance
  const max = len >= 7 ? 2 : 1;
  const homeMax = max + 1;

  const bucket = getSuggestionIndex().statesByFirstChar.get(queryLower[0]) ?? [];
  const hits: Array<{ state: StateEntry; dist: number; home: boolean }> = [];

  for (const state of bucket) {
    const home = state.countryCode === HOME_COUNTRY;
    const limit = home ? homeMax : max;
    const name = state.nameLower;
    if (name.length < len - limit || name.length > len + limit) continue;

    const dist = boundedEditDistance(queryLower, name, limit);
    if (dist <= limit) hits.push({ state, dist, home });
  }

  hits.sort((a, b) => {
    if (a.home !== b.home) return a.home ? -1 : 1;
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.state.name.length - b.state.name.length;
  });
  return hits.slice(0, 5).map((h) => ({ entry: h.state, dist: h.dist }));
}

export function fuzzyCountries(queryLower: string): Array<{ entry: CountryEntry; dist: number }> {
  const len = queryLower.length;
  if (len < 4) return []; // too short for a meaningful edit distance
  const max = len >= 7 ? 2 : 1;

  const bucket = getSuggestionIndex().countriesByFirstChar.get(queryLower[0]) ?? [];
  const hits: Array<{ country: CountryEntry; dist: number }> = [];

  for (const country of bucket) {
    const limit = max; // No home advantage strictly needed for countries since there are so few, but we use standard limit
    const name = country.nameLower;
    if (name.length < len - limit || name.length > len + limit) continue;

    const dist = boundedEditDistance(queryLower, name, limit);
    if (dist <= limit) hits.push({ country, dist });
  }

  hits.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.country.name.length - b.country.name.length;
  });
  return hits.slice(0, 5).map((h) => ({ entry: h.country, dist: h.dist }));
}
