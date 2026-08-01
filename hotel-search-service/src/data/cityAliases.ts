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

/**
 * International city aliases: colloquial or "known as" names for famous world
 * destinations that the `country-state-city` dataset stores under a different
 * (usually shorter) canonical name.
 *
 * Each entry carries a `countryCode` so the resolver can bypass the
 * home-country filter and pin the result to the intended nation.
 *
 * Keys are normalized (lowercase, spaces preserved — "lake como" not "lakecomo").
 */
export interface IntlAliasEntry {
  /** The canonical name as stored in `country-state-city`. */
  canonical: string;
  /** ISO 3166-1 alpha-2 country code for the intended city. */
  countryCode: string;
}

export const INTERNATIONAL_CITY_ALIASES: Record<string, IntlAliasEntry> = {
  // Italy – common "Lake X" names resolve to the city on/near the lake.
  "lake como": { canonical: "Como", countryCode: "IT" },
  "lago di como": { canonical: "Como", countryCode: "IT" },
  "lake garda": { canonical: "Peschiera del Garda", countryCode: "IT" },
  "lago di garda": { canonical: "Peschiera del Garda", countryCode: "IT" },
  "lake maggiore": { canonical: "Stresa", countryCode: "IT" },
  venice: { canonical: "Venice", countryCode: "IT" },
  venezia: { canonical: "Venice", countryCode: "IT" },
  florence: { canonical: "Florence", countryCode: "IT" },
  firenze: { canonical: "Florence", countryCode: "IT" },
  milan: { canonical: "Milan", countryCode: "IT" },
  milano: { canonical: "Milan", countryCode: "IT" },
  rome: { canonical: "Rome", countryCode: "IT" },
  roma: { canonical: "Rome", countryCode: "IT" },
  naples: { canonical: "Naples", countryCode: "IT" },
  napoli: { canonical: "Naples", countryCode: "IT" },
  turin: { canonical: "Turin", countryCode: "IT" },
  torino: { canonical: "Turin", countryCode: "IT" },

  // France
  paris: { canonical: "Paris", countryCode: "FR" },
  nice: { canonical: "Nice", countryCode: "FR" },
  lyon: { canonical: "Lyon", countryCode: "FR" },
  marseille: { canonical: "Marseille", countryCode: "FR" },
  bordeaux: { canonical: "Bordeaux", countryCode: "FR" },
  cannes: { canonical: "Cannes", countryCode: "FR" },
  monaco: { canonical: "Monaco", countryCode: "MC" },

  // Spain
  barcelona: { canonical: "Barcelona", countryCode: "ES" },
  madrid: { canonical: "Madrid", countryCode: "ES" },
  seville: { canonical: "Seville", countryCode: "ES" },
  sevilla: { canonical: "Seville", countryCode: "ES" },
  ibiza: { canonical: "Ibiza", countryCode: "ES" },
  mallorca: { canonical: "Palma", countryCode: "ES" },
  majorca: { canonical: "Palma", countryCode: "ES" },
  granada: { canonical: "Granada", countryCode: "ES" },
  valencia: { canonical: "Valencia", countryCode: "ES" },

  // UK
  london: { canonical: "London", countryCode: "GB" },
  edinburgh: { canonical: "Edinburgh", countryCode: "GB" },
  manchester: { canonical: "Manchester", countryCode: "GB" },
  liverpool: { canonical: "Liverpool", countryCode: "GB" },
  "lake district": { canonical: "Windermere", countryCode: "GB" },

  // UAE
  dubai: { canonical: "Dubai", countryCode: "AE" },
  "abu dhabi": { canonical: "Abu Dhabi", countryCode: "AE" },
  sharjah: { canonical: "Sharjah", countryCode: "AE" },

  // Turkey
  istanbul: { canonical: "Istanbul", countryCode: "TR" },
  ankara: { canonical: "Ankara", countryCode: "TR" },
  antalya: { canonical: "Antalya", countryCode: "TR" },
  cappadocia: { canonical: "Nevşehir", countryCode: "TR" },

  // Thailand
  bangkok: { canonical: "Bangkok", countryCode: "TH" },
  phuket: { canonical: "Phuket City", countryCode: "TH" },
  "chiang mai": { canonical: "Chiang Mai", countryCode: "TH" },
  pattaya: { canonical: "Pattaya", countryCode: "TH" },
  "koh samui": { canonical: "Ko Samui", countryCode: "TH" },

  // Bali / Indonesia
  bali: { canonical: "Denpasar", countryCode: "ID" },
  denpasar: { canonical: "Denpasar", countryCode: "ID" },
  jakarta: { canonical: "Jakarta", countryCode: "ID" },

  // Singapore & Malaysia
  singapore: { canonical: "Singapore", countryCode: "SG" },
  "kuala lumpur": { canonical: "Kuala Lumpur", countryCode: "MY" },
  kl: { canonical: "Kuala Lumpur", countryCode: "MY" },
  penang: { canonical: "George Town", countryCode: "MY" },
  langkawi: { canonical: "Langkawi", countryCode: "MY" },

  // Japan
  tokyo: { canonical: "Tokyo", countryCode: "JP" },
  kyoto: { canonical: "Kyoto", countryCode: "JP" },
  osaka: { canonical: "Osaka", countryCode: "JP" },
  hiroshima: { canonical: "Hiroshima", countryCode: "JP" },
  sapporo: { canonical: "Sapporo", countryCode: "JP" },

  // South Korea
  seoul: { canonical: "Seoul", countryCode: "KR" },
  busan: { canonical: "Busan", countryCode: "KR" },
  jeju: { canonical: "Jeju City", countryCode: "KR" },

  // China
  beijing: { canonical: "Beijing", countryCode: "CN" },
  shanghai: { canonical: "Shanghai", countryCode: "CN" },
  "hong kong": { canonical: "Hong Kong", countryCode: "HK" },
  macau: { canonical: "Macau", countryCode: "MO" },

  // USA – popular destinations
  "new york": { canonical: "New York City", countryCode: "US" },
  nyc: { canonical: "New York City", countryCode: "US" },
  "las vegas": { canonical: "Las Vegas", countryCode: "US" },
  "los angeles": { canonical: "Los Angeles", countryCode: "US" },
  miami: { canonical: "Miami", countryCode: "US" },
  orlando: { canonical: "Orlando", countryCode: "US" },
  "san francisco": { canonical: "San Francisco", countryCode: "US" },
  chicago: { canonical: "Chicago", countryCode: "US" },
  honolulu: { canonical: "Honolulu", countryCode: "US" },

  // Maldives
  maldives: { canonical: "Malé", countryCode: "MV" },
  male: { canonical: "Malé", countryCode: "MV" },

  // Sri Lanka
  colombo: { canonical: "Colombo", countryCode: "LK" },
  kandy: { canonical: "Kandy", countryCode: "LK" },
  "sri lanka": { canonical: "Colombo", countryCode: "LK" },

  // Nepal
  kathmandu: { canonical: "Kathmandu", countryCode: "NP" },
  pokhara: { canonical: "Pokhara", countryCode: "NP" },

  // Greece
  athens: { canonical: "Athens", countryCode: "GR" },
  santorini: { canonical: "Fira", countryCode: "GR" },
  mykonos: { canonical: "Mykonos", countryCode: "GR" },

  // Egypt
  cairo: { canonical: "Cairo", countryCode: "EG" },
  luxor: { canonical: "Luxor", countryCode: "EG" },
  "hurghada": { canonical: "Hurghada", countryCode: "EG" },

  // South Africa
  "cape town": { canonical: "Cape Town", countryCode: "ZA" },
  johannesburg: { canonical: "Johannesburg", countryCode: "ZA" },
  durban: { canonical: "Durban", countryCode: "ZA" },

  // Australia
  sydney: { canonical: "Sydney", countryCode: "AU" },
  melbourne: { canonical: "Melbourne", countryCode: "AU" },
  "gold coast": { canonical: "Gold Coast", countryCode: "AU" },
  brisbane: { canonical: "Brisbane", countryCode: "AU" },

  // Portugal
  lisbon: { canonical: "Lisbon", countryCode: "PT" },
  porto: { canonical: "Porto", countryCode: "PT" },
  algarve: { canonical: "Faro", countryCode: "PT" },

  // Germany
  berlin: { canonical: "Berlin", countryCode: "DE" },
  munich: { canonical: "Munich", countryCode: "DE" },
  munchen: { canonical: "Munich", countryCode: "DE" },
  frankfurt: { canonical: "Frankfurt", countryCode: "DE" },
  hamburg: { canonical: "Hamburg", countryCode: "DE" },

  // Netherlands
  amsterdam: { canonical: "Amsterdam", countryCode: "NL" },

  // Switzerland
  zurich: { canonical: "Zurich", countryCode: "CH" },
  geneva: { canonical: "Geneva", countryCode: "CH" },
  interlaken: { canonical: "Interlaken", countryCode: "CH" },

  // Austria
  vienna: { canonical: "Vienna", countryCode: "AT" },
  salzburg: { canonical: "Salzburg", countryCode: "AT" },
  innsbruck: { canonical: "Innsbruck", countryCode: "AT" },

  // Czech Republic
  prague: { canonical: "Prague", countryCode: "CZ" },

  // Hungary
  budapest: { canonical: "Budapest", countryCode: "HU" },

  // Croatia
  dubrovnik: { canonical: "Dubrovnik", countryCode: "HR" },
  split: { canonical: "Split", countryCode: "HR" },

  // Philippines
  manila: { canonical: "Manila", countryCode: "PH" },
  boracay: { canonical: "Kalibo", countryCode: "PH" },
  cebu: { canonical: "Cebu City", countryCode: "PH" },

  // Vietnam
  "ho chi minh": { canonical: "Ho Chi Minh City", countryCode: "VN" },
  saigon: { canonical: "Ho Chi Minh City", countryCode: "VN" },
  hanoi: { canonical: "Hanoi", countryCode: "VN" },
  "ha noi": { canonical: "Hanoi", countryCode: "VN" },
  "da nang": { canonical: "Da Nang", countryCode: "VN" },
  "hoi an": { canonical: "Hội An", countryCode: "VN" },

  // Cambodia
  "siem reap": { canonical: "Siem Reap", countryCode: "KH" },
  angkor: { canonical: "Siem Reap", countryCode: "KH" },

  // Bhutan
  thimphu: { canonical: "Thimphu", countryCode: "BT" },
  paro: { canonical: "Paro", countryCode: "BT" },

  // Canada
  toronto: { canonical: "Toronto", countryCode: "CA" },
  vancouver: { canonical: "Vancouver", countryCode: "CA" },
  montreal: { canonical: "Montreal", countryCode: "CA" },
  "niagara falls": { canonical: "Niagara Falls", countryCode: "CA" },

  // Mexico
  cancun: { canonical: "Cancún", countryCode: "MX" },
  "mexico city": { canonical: "Mexico City", countryCode: "MX" },

  // Bahrain
  manama: { canonical: "Manama", countryCode: "BH" },

  // Saudi Arabia
  riyadh: { canonical: "Riyadh", countryCode: "SA" },
  jeddah: { canonical: "Jeddah", countryCode: "SA" },

  // Jordan
  amman: { canonical: "Amman", countryCode: "JO" },
  petra: { canonical: "Wadi Musa", countryCode: "JO" },

  // Israel
  "tel aviv": { canonical: "Tel Aviv", countryCode: "IL" },
  jerusalem: { canonical: "Jerusalem", countryCode: "IL" },
};

/** Resolve a normalized query to its canonical dataset name, if it is an alias. */
export function resolveCityAlias(normalizedQuery: string): string | null {
  return CITY_ALIASES[normalizedQuery] ?? STATE_ALIASES[normalizedQuery] ?? null;
}

/** Resolve a normalized query to an international city entry, if it is an alias. */
export function resolveInternationalAlias(normalizedQuery: string): IntlAliasEntry | null {
  return INTERNATIONAL_CITY_ALIASES[normalizedQuery] ?? null;
}

export interface AliasMatch {
  /** The alias the user was part-way through typing ("bombay"). */
  alias: string;
  /** The dataset name it points at ("Mumbai"). */
  canonical: string;
  kind: "city" | "state";
  /** ISO country code, only set for international aliases. */
  countryCode?: string;
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

  // International aliases: collect separately so caller can bypass home-country filter.
  for (const alias in INTERNATIONAL_CITY_ALIASES) {
    if (alias.startsWith(normalizedQuery)) {
      const entry = INTERNATIONAL_CITY_ALIASES[alias];
      matches.push({ alias, canonical: entry.canonical, kind: "city", countryCode: entry.countryCode });
    }
  }

  matches.sort((a, b) => a.alias.length - b.alias.length || a.alias.localeCompare(b.alias));
  return matches.slice(0, limit);
}
