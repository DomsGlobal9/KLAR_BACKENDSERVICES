/**
 * Which markup region a journey falls in.
 *
 * ─── THIS FILE IS DUPLICATED ────────────────────────────────────────────────
 * An identical copy lives at hotel-booking-service/src/utils/region.util.ts,
 * and region.test.ts in BOTH services pins the same vectors. There is no shared
 * package in this repo, and the alternative — each service inventing its own
 * rule — is the specific failure the duplication is guarding against.
 *
 * WHY THE TWO MUST AGREE EXACTLY
 * ------------------------------
 * Search prices a stay with the region's markup; commit re-derives the region
 * and re-applies it to validate the price. If the two disagree by even one
 * country, the customer is quoted one price and charged another, and the only
 * symptom is a commit failing price validation with no indication which side is
 * wrong. hotel-booking's resolveMarkupRules already carries this warning for
 * the channel (B2B/B2C) split; region multiplies the same risk.
 *
 * If you edit this file, edit the other copy in the same commit.
 */

export type MarkupRegion = "DOMESTIC" | "INTERNATIONAL" | "ALL";

/** The home market. A stay inside it is DOMESTIC; everything else is not. */
export const HOME_COUNTRY = "IN";

/**
 * Country names that appear in our hotel records for the home market. The
 * TripJack static feed stores a country NAME (`countryName`), not an ISO code,
 * so a name path is unavoidable on that side.
 */
const HOME_COUNTRY_NAMES = new Set(["india", "in", "ind", "bharat"]);

/**
 * Maps a country signal to a region.
 *
 * Returns "ALL" — the catch-all, never a guess at DOMESTIC or INTERNATIONAL —
 * when the country is unknown. That matters: guessing INTERNATIONAL would
 * overcharge, guessing DOMESTIC would undercharge, and both would differ from
 * whatever the other service guessed. "ALL" is the one answer that is the same
 * on both sides and resolves to the catch-all rule every pre-region config
 * already migrated to.
 *
 * Accepts either an ISO-2 code ("IN", "AE") or a country name ("India"),
 * because search carries the code and the hotel records carry the name.
 */
export function deriveRegion(country?: string | null): MarkupRegion {
  const raw = (country ?? "").trim().toLowerCase();
  if (!raw) return "ALL";

  if (raw.length === 2) {
    return raw === HOME_COUNTRY.toLowerCase() ? "DOMESTIC" : "INTERNATIONAL";
  }

  if (HOME_COUNTRY_NAMES.has(raw)) return "DOMESTIC";

  // A country name we do recognise as a name — anything non-empty and longer
  // than a code — is a real country that is not the home market.
  return "INTERNATIONAL";
}

/**
 * Picks the first usable country signal, in order of trustworthiness, and
 * derives the region from it.
 *
 * Callers pass candidates most-authoritative-first; blank and unknown values
 * fall through rather than resolving to "ALL" and masking a good signal further
 * down the list.
 */
export function deriveRegionFrom(
  ...candidates: Array<string | null | undefined>
): MarkupRegion {
  for (const c of candidates) {
    const region = deriveRegion(c);
    if (region !== "ALL") return region;
  }
  return "ALL";
}
