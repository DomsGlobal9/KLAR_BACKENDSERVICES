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
