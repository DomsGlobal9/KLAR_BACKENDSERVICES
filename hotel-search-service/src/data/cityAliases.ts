/**
 * Common and historical place names mapped to the name the geo dataset uses.
 *
 * These are aliases, not misspellings: no edit-distance tolerance turns
 * "Trivandrum" into "Thiruvananthapuram". Without this table a traveller typing
 * the name they actually say gets an empty dropdown ("Mysore", "Pondicherry",
 * "Benares") or the wrong city ("Baroda" → Baloda).
 *
 * Keys are normalized (lowercase, unaccented). Values must exist verbatim in
 * `country-state-city`; scripts/validateCityAliases.ts enforces that.
 */
export const CITY_ALIASES: Record<string, string> = {
  // Old name in daily use, dataset carries the new official name.
  mysore: "Mysuru",
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  madras: "Chennai",
  calcutta: "Kolkata",
  trivandrum: "Thiruvananthapuram",
  pondicherry: "Puducherry",
  baroda: "Vadodara",
  poona: "Pune",
  simla: "Shimla",
  mangalore: "Mangaluru",
  belgaum: "Belagavi",
  hubli: "Hubballi",
  bellary: "Ballari",
  tuticorin: "Thoothukudi",
  panjim: "Panaji",
  tumkur: "Tumakuru",
  cannanore: "Kannur",
  quilon: "Kollam",
  alleppey: "Alappuzha",
  calicut: "Kozhikode",
  broach: "Bharuch",
  waltair: "Visakhapatnam",

  // New official name, dataset still carries the old one. The mapping runs
  // whichever way the data actually needs — that is what the validator checks.
  kochi: "Cochin",
  gurugram: "Gurgaon",
  prayagraj: "Allahabad",
  udhagamandalam: "Ooty",
  shivamogga: "Shimoga",

  // Gulbarga was renamed Kalaburagi, but the dataset spells it "Kalaburgi"
  // (no second "a"). Both the old name and the correct new spelling have to
  // point at the dataset's spelling or neither resolves.
  gulbarga: "Kalaburgi",
  kalaburagi: "Kalaburgi",

  // Colloquial short forms and older transliterations.
  benares: "Varanasi",
  banaras: "Varanasi",
  vizag: "Visakhapatnam",
  trichy: "Tiruchirappalli",
};

/**
 * Renamed states. Kept separate from the city table because the validator has
 * to check these against `State`, not `City` — a state name is never a city and
 * would fail the city lookup. Resolution itself is shared: `canonicalize` runs
 * before both `matchStates` and `matchCities`, so one pass covers both.
 */
export const STATE_ALIASES: Record<string, string> = {
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
};

/** Resolve a normalized query to its canonical dataset name, if it is an alias. */
export function resolveCityAlias(normalizedQuery: string): string | null {
  return CITY_ALIASES[normalizedQuery] ?? STATE_ALIASES[normalizedQuery] ?? null;
}

export interface AliasMatch {
  /** The alias the user was part-way through typing ("bombay"). */
  alias: string;
  /** The dataset name it points at ("Mumbai"). */
  canonical: string;
  kind: "city" | "state";
}

/**
 * Aliases the query *prefixes*, so the suggestion appears while typing.
 *
 * Exact lookup alone means Mumbai only surfaces on the full "bombay" — nobody
 * types a whole word before expecting a dropdown. "bom" has to reach it too.
 *
 * Deliberately returns every alias the query prefixes rather than picking one:
 * "ba" legitimately means Bangalore, Baroda or Banaras, and the caller's normal
 * ranking is what decides between them. Shorter aliases come first — they are
 * the closer completion of what has been typed so far.
 */
export function matchAliasPrefixes(normalizedQuery: string, limit = 6): AliasMatch[] {
  if (!normalizedQuery) return [];

  const matches: AliasMatch[] = [];
  const collect = (table: Record<string, string>, kind: "city" | "state") => {
    for (const alias in table) {
      if (alias.startsWith(normalizedQuery)) {
        matches.push({ alias, canonical: table[alias], kind });
      }
    }
  };
  collect(CITY_ALIASES, "city");
  collect(STATE_ALIASES, "state");

  matches.sort((a, b) => a.alias.length - b.alias.length || a.alias.localeCompare(b.alias));
  return matches.slice(0, limit);
}
