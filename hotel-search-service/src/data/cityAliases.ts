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

  // New official name, dataset still carries the old one. The mapping runs
  // whichever way the data actually needs — that is what the validator checks.
  kochi: "Cochin",
  gurugram: "Gurgaon",
  prayagraj: "Allahabad",
  udhagamandalam: "Ooty",

  // Colloquial short forms and older transliterations.
  benares: "Varanasi",
  banaras: "Varanasi",
  vizag: "Visakhapatnam",
  trichy: "Tiruchirappalli",
};

/** Resolve a normalized query to its canonical dataset name, if it is an alias. */
export function resolveCityAlias(normalizedQuery: string): string | null {
  return CITY_ALIASES[normalizedQuery] ?? null;
}

/**
 * Maps legacy or common alternative city names to their canonical names
 * as expected by the geo dataset or OpenCage.
 */
export const CITY_ALIASES: Record<string, string> = {
  "mysore": "Mysuru",
  "bangalore": "Bengaluru",
  "bombay": "Mumbai",
  "madras": "Chennai",
  "calcutta": "Kolkata",
  "poona": "Pune",
  "gurgaon": "Gurugram",
  "benares": "Varanasi",
  "banaras": "Varanasi",
  "baroda": "Vadodara",
  "trivandrum": "Thiruvananthapuram",
  "cochin": "Kochi",
  "pondicherry": "Puducherry",
  "belgaum": "Belagavi",
  "mangalore": "Mangaluru",
  "hubli": "Hubballi",
  "panjim": "Panaji"
};

export function resolveCityAlias(query: string): string | null {
  const normalized = query.toLowerCase().trim();
  return CITY_ALIASES[normalized] || null;
}
