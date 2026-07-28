/**
 * Decides which markup region a commit is priced under.
 *
 * THE PROBLEM THIS SOLVES
 * ----------------------
 * Search prices a stay with a region's markup; commit re-applies markup to
 * validate that price. If the two pick different regions the customer is quoted
 * one price and charged another, and the only symptom is a commit failing price
 * validation with no indication which side is wrong.
 *
 * WHY THE CLIENT'S REGION IS NEVER TRUSTED
 * ----------------------------------------
 * The search response stamps the region it used, and the client sends it back.
 * That value is useful — it tells us what the customer was quoted — but it must
 * never SELECT the markup: a client that claims DOMESTIC on an international
 * stay would simply pay the cheaper margin. So the claim is used only to detect
 * disagreement; the region actually applied is always derived here, server-side,
 * from the supplier's own response.
 *
 * WHY UNKNOWN RESOLVES TO "ALL"
 * -----------------------------
 * `hotels` in the search DB is keyed by tjHotelId — TripJack only — and there is
 * no RateGain property collection, so a DB lookup cannot cover both suppliers.
 * The supplier precheck payload is the one source available for both, and its
 * shape varies. When no country can be found we resolve ALL (the catch-all every
 * pre-region config migrated to) rather than guessing a region — a guess would
 * be wrong half the time and would differ from whatever search decided.
 */

import { MarkupRegion, deriveRegion } from "./region.util";

export interface BookingRegionDecision {
  /** The region the commit is priced under. Never taken from the client. */
  region: MarkupRegion;
  /** Country the decision came from, for logs. */
  country: string | null;
  /** Where that country was read from, for measuring extraction coverage. */
  source: "supplier" | "none";
  /** What the client said search used. Diagnostic only. */
  claimed: MarkupRegion | null;
  /**
   * True when a verified region disagrees with the client's claim. The caller
   * must treat this as a price-integrity failure, not a warning to swallow:
   * it means the quote and the charge were computed differently.
   */
  mismatch: boolean;
  /**
   * True when the client claimed a specific region but we could not verify it.
   * Not an error — but it is the number to watch before enabling any
   * region-specific rule, because it is exactly where quote and charge could
   * silently diverge.
   */
  unverified: boolean;
}

/**
 * Country paths seen across TripJack and RateGain precheck payloads.
 *
 * Deliberately a list of explicit paths rather than a recursive search: a blind
 * hunt for any key named "country" would happily pick up the GUEST's country
 * (the payloads carry both) and price an international stay as domestic for
 * every Indian customer.
 */
const COUNTRY_PATHS: string[][] = [
  // RateGain — CommitReservation/PreCheck hotel block
  ["body", "preCheckResponse", "hotel", "countryName"],
  ["body", "preCheckResponse", "hotel", "country"],
  ["body", "hotel", "countryName"],
  ["body", "hotel", "country"],
  ["hotel", "countryName"],
  ["hotel", "country"],
  // TripJack — hotel info block
  ["body", "hInfo", "ad", "cn"],
  ["body", "hInfo", "ad", "country"],
  ["body", "hInfo", "country"],
  ["hInfo", "ad", "cn"],
  ["hInfo", "ad", "country"],
  ["hInfo", "country"],
  // Shapes both suppliers have been seen to use at the top level
  ["hotelCountry"],
  ["countryName"],
];

function readPath(obj: any, path: string[]): string | null {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object")
      return null;
    cur = cur[key];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : null;
}

/** First country found among the known paths, or null. */
export function extractSupplierCountry(precheckResponse: any): string | null {
  if (!precheckResponse || typeof precheckResponse !== "object") return null;
  for (const path of COUNTRY_PATHS) {
    const found = readPath(precheckResponse, path);
    if (found) return found;
  }
  return null;
}

const asRegion = (value?: string | null): MarkupRegion | null => {
  const raw = (value ?? "").toUpperCase().trim();
  return raw === "DOMESTIC" || raw === "INTERNATIONAL" || raw === "ALL"
    ? (raw as MarkupRegion)
    : null;
};

/**
 * Resolves the region a commit is priced under.
 *
 * `claimedRegion` is whatever the client echoed back from search. It is
 * recorded and compared, never used to choose.
 */
export function resolveBookingRegion(args: {
  precheckResponse?: any;
  claimedRegion?: string | null;
}): BookingRegionDecision {
  const claimed = asRegion(args.claimedRegion);
  const country = extractSupplierCountry(args.precheckResponse);
  const derived = deriveRegion(country);

  if (derived !== "ALL") {
    return {
      region: derived,
      country,
      source: "supplier",
      claimed,
      // ALL is not a disagreement: it means search had no region rule either.
      mismatch: claimed !== null && claimed !== "ALL" && claimed !== derived,
      unverified: false,
    };
  }

  return {
    region: "ALL",
    country: null,
    source: "none",
    claimed,
    mismatch: false,
    unverified: claimed !== null && claimed !== "ALL",
  };
}

/**
 * One line per commit, so extraction coverage is measurable from logs before
 * any region-specific rule is switched on.
 */
export function describeRegionDecision(d: BookingRegionDecision): string {
  return (
    `[markup-region] applied=${d.region} source=${d.source} ` +
    `country=${d.country ?? "-"} claimed=${d.claimed ?? "-"}` +
    (d.mismatch ? " MISMATCH" : "") +
    (d.unverified ? " UNVERIFIED" : "")
  );
}
