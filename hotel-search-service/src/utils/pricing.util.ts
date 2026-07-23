/**
 * pricing.util.ts
 * Centralises all hotel pricing & markup computation for hotel-search-service.
 *
 * Computation here is pure and synchronous. The one dependency is a sync read
 * of the master markup snapshot (config/markup-config.ts) — no I/O happens on
 * this path; refreshing the snapshot is the request head's job.
 */

import { getMarkupConfig } from "../config/markup-config";
import { MarkupRegion } from "./region.util";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface MarkupRule {
  serviceType: string;
  /** Absent on rules written before regions existed — treat as "ALL". */
  region?: MarkupRegion;
  percentageMarkup: number;
  fixedMarkup: number;
}

export interface EnrichedPricing {
  basePrice: number;
  markupAmount: number;
  perNightPrice: number;
  supplierTotalPrice: number;
  finalTotalPrice: number;
  taxesIncluded: boolean;
}

// ---------------------------------------------------------------------------
// calculateNights
// ---------------------------------------------------------------------------

/**
 * Returns the number of nights between two date strings.
 * Falls back to 1 on any error or invalid input.
 */
export function calculateNights(
  checkin: string | undefined,
  checkout: string | undefined,
): number {
  try {
    if (!checkin || !checkout) return 1;
    const diff = new Date(checkout).getTime() - new Date(checkin).getTime();
    return Math.max(1, Math.round(diff / 86_400_000));
  } catch {
    return 1;
  }
}

export const calculateNightsFromDates = calculateNights;

// ---------------------------------------------------------------------------
// calculateEnrichedPricing
// ---------------------------------------------------------------------------

export interface PricingInput {
  basePrice: number;
  totalPrice: number;
  taxes: number;
  mf: number;
  mft: number;
  currency: string;
  /** Optional explicit override.  When omitted, derived from taxes+mf+mft. */
  taxesIncluded?: boolean;
}

/**
 * Calculates all enriched pricing fields for a hotel rate.
 *
 * Markup resolution order:
 *  1. First rule whose serviceType is 'HOTELS' or 'HOTEL' (case-insensitive)
 *  2. If found and percentageMarkup > 0  →  markupAmount = totalPrice * percentageMarkup / 100
 *  3. Else if found and fixedMarkup > 0  →  markupAmount = fixedMarkup
 *  4. Otherwise                          →  markupAmount = 0  (covers B2C / no-rule case)
 */
export function calculateEnrichedPricing(
  input: PricingInput,
  markupRules: MarkupRule[],
  nights: number,
): EnrichedPricing {
  const { basePrice, totalPrice, taxes, mf, mft, currency: _currency } = input;

  // --- markup resolution ---
  const rule = markupRules.find(
    (r) =>
      r.serviceType.toUpperCase() === "HOTELS" ||
      r.serviceType.toUpperCase() === "HOTEL",
  );

  // Percentage-markup base. Default GROSS (tax-inclusive total) to preserve the
  // existing agent pricing exactly. Set HOTEL_MARKUP_ON=NET to mark up only the
  // net room rate — i.e. stop marking up government taxes, as most OTAs do.
  const markupBase =
    (process.env.HOTEL_MARKUP_ON || "GROSS").toUpperCase() === "NET"
      ? basePrice
      : totalPrice;

  let markupAmount = 0;
  if (rule) {
    if (rule.percentageMarkup > 0) {
      markupAmount = (markupBase * rule.percentageMarkup) / 100;
    } else if (rule.fixedMarkup > 0) {
      markupAmount = rule.fixedMarkup;
    }
  }

  // --- derived totals ---
  const supplierTotalPrice = totalPrice;
  const finalTotalPrice = totalPrice + markupAmount;
  const safeNights = nights >= 1 ? nights : 1;
  // Per-night is derived from the FINAL price the customer pays so that
  // perNightPrice * nights reconciles with finalTotalPrice (no "×nights ≠ total").
  const perNightPrice = finalTotalPrice / safeNights;

  // --- taxesIncluded ---
  const taxesIncluded =
    input.taxesIncluded !== undefined
      ? input.taxesIncluded
      : taxes + mf + mft === 0;

  return {
    basePrice,
    markupAmount,
    perNightPrice,
    supplierTotalPrice,
    finalTotalPrice,
    taxesIncluded,
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// buildPublicPricing — the ONE block clients read
// ---------------------------------------------------------------------------

export interface PublicPricing {
  basePrice: number;
  /** Everything charged on top of basePrice: taxes + management fees. */
  taxesAndFees: number;
  /** The number to display and charge. Always === basePrice + taxesAndFees. */
  totalPrice: number;
  currency: string;
  perNightPrice: number;
  taxesIncluded: boolean;

  /** Supplier's own split of taxesAndFees, when it gives one. Display only. */
  taxes: number;
  mf: number;
  mft: number;

  /** Internal/audit. Never render these. */
  markupAmount: number;
  supplierTotalPrice: number;
  finalTotalPrice: number;
}

/**
 * Shapes an EnrichedPricing into the client-facing block, per channel.
 *
 * B2C — the master's B2C margin is invisible to the customer by design, so it
 *       is folded into basePrice and totalPrice is the marked-up total.
 * B2B — the agent's own margin is theirs to see and edit, so the block stays
 *       decomposed: basePrice is the api net, totalPrice the api total, and the
 *       agent's markup is applied downstream from finalTotalPrice.
 *
 * WHY taxesAndFees IS DERIVED AND NOT SUMMED
 * ------------------------------------------
 * basePrice + taxesAndFees === totalPrice must hold at every call site, but the
 * sites disagree on how much of the gap they can name: the products path knows
 * taxes/mf/mft, while the search-list path only knows `taxes` and has no field
 * for the management fees. Summing the named parts there yields a breakdown
 * that silently comes up short of the total. Deriving the gap instead makes the
 * identity true by construction, and the named parts stay as display detail.
 *
 * A breakdown that does not add up is exactly how the B2C markup went missing
 * before: each UI surface picked a different "total" to paper over the gap, and
 * the markup vanished somewhere between the search card and the review page.
 */
export function buildPublicPricing(args: {
  enriched: EnrichedPricing;
  taxes: number;
  mf: number;
  mft: number;
  currency: string;
  clientType: "B2B" | "B2C";
}): PublicPricing {
  const { enriched, taxes, mf, mft, currency, clientType } = args;
  const isB2C = clientType === "B2C";

  const basePrice = isB2C
    ? round2(enriched.basePrice + enriched.markupAmount)
    : round2(enriched.basePrice);
  const totalPrice = isB2C
    ? round2(enriched.finalTotalPrice)
    : round2(enriched.supplierTotalPrice);

  return {
    basePrice,
    taxesAndFees: round2(totalPrice - basePrice),
    totalPrice,
    currency,
    perNightPrice: round2(enriched.perNightPrice),
    taxesIncluded: enriched.taxesIncluded,
    taxes: round2(taxes),
    mf: round2(mf),
    mft: round2(mft),
    markupAmount: round2(enriched.markupAmount),
    supplierTotalPrice: round2(enriched.supplierTotalPrice),
    finalTotalPrice: round2(enriched.finalTotalPrice),
  };
}

// ---------------------------------------------------------------------------
// PLATFORM (KLAR master) markup
// A hidden margin the platform adds to the RAW supplier net BEFORE anyone sees
// it. Agents (and their customers) perceive the result as "the API price".
// Master-configured via auth-service; the agent's own markup is applied AFTER.
//   supplier net 500  --(+platform 100)-->  api net 600  --(+agent markup)-->  sell price
// The supplier is still paid the raw net (500) at booking — see stripPlatformMarkup().
//
// The values come from the snapshot in config/markup-config.ts, which the
// request head refreshes. Reading it per call (rather than caching a module
// const as this file used to) is what lets a master's change take effect
// without a redeploy.
// ---------------------------------------------------------------------------

export interface PlatformMarkupConfig {
  enabled: boolean;
  type: "FIXED" | "PERCENTAGE";
  value: number;
}

/** @deprecated Reads the live snapshot. Kept as a getter so existing callers
 *  that touch `PLATFORM_MARKUP.value` don't silently freeze on env defaults. */
export const PLATFORM_MARKUP = {
  get enabled() {
    return getMarkupConfig().platform.enabled;
  },
  get type() {
    return getMarkupConfig().platform.type;
  },
  get value() {
    return getMarkupConfig().platform.value;
  },
} as PlatformMarkupConfig;

/**
 * Amount the platform adds on top of a raw supplier NET price.
 *
 * `region` is passed explicitly rather than read from module state: the sync
 * pricing path runs after supplier awaits, so a shared "current region" would
 * be overwritten by whatever request happened to interleave. Defaults to ALL,
 * which is the catch-all every pre-region config migrated to.
 */
export function platformMarkupAmount(
  supplierNet: number,
  region: MarkupRegion = "ALL",
): number {
  const cfg = getMarkupConfig(region).platform;
  if (!cfg.enabled || !supplierNet || supplierNet <= 0) return 0;
  const amt =
    cfg.type === "PERCENTAGE" ? (supplierNet * cfg.value) / 100 : cfg.value;
  return round2(Math.max(0, amt));
}

/** api net (what the agent sees) = supplier net + platform markup. */
export function applyPlatformMarkup(
  supplierNet: number,
  region: MarkupRegion = "ALL",
): number {
  return round2(supplierNet + platformMarkupAmount(supplierNet, region));
}

/** Reverse of applyPlatformMarkup: recover the raw supplier NET to send to the supplier. */
export function stripPlatformMarkup(
  apiNet: number,
  region: MarkupRegion = "ALL",
): number {
  // MUST use the same region applyPlatformMarkup used, or the net we send the
  // supplier will not be the net we marked up.
  const cfg = getMarkupConfig(region).platform;
  if (!cfg.enabled || !apiNet || apiNet <= 0) return round2(apiNet);
  if (cfg.type === "PERCENTAGE") {
    return round2(apiNet / (1 + cfg.value / 100));
  }
  return round2(Math.max(0, apiNet - cfg.value));
}

// ---------------------------------------------------------------------------
// deriveRefundable — single source of truth for refundable/non-refundable
// Works for BOTH TripJack (explicit flag) and RateGain (derive from policies).
// No fabrication: when there is genuinely no signal we return isRefundable=false
// (the conservative, customer-safe default) and flag unknown=true so the UI can
// show a neutral state instead of a false promise.
// ---------------------------------------------------------------------------

export interface RefundableInfo {
  isRefundable: boolean;
  freeCancellationUntil: string | null; // ISO date when penalties begin
  label: string; // display-ready, computed once on the backend
  unknown: boolean; // true when no supplier signal was available
}

const fmtCxlDate = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

/**
 * @param explicit  Supplier-provided boolean (TripJack `cancellation.isRefundable`). undefined for RG.
 * @param cancellationPolicies  Array of { amount, from, toDate } (RG) or penalties (TJ).
 * @param rateComments  Free-text rate notes (RG embeds "NON-REFUNDABLE RATE" here).
 */
export function deriveRefundable(opts: {
  explicit?: boolean;
  cancellationPolicies?: any[];
  rateComments?: string;
}): RefundableInfo {
  const policies = Array.isArray(opts.cancellationPolicies)
    ? opts.cancellationPolicies
    : [];
  const comments = opts.rateComments || "";

  const firstPaid = policies.find((p) => Number(p.amount) > 0 && (p.from || p.toDate));
  const freeWindow = policies.find((p) => Number(p.amount) === 0 && (p.from || p.toDate));
  const freeUntilIso: string | null =
    (firstPaid?.from || firstPaid?.toDate || freeWindow?.toDate || freeWindow?.from) ?? null;

  // 1. Explicit supplier flag wins (TripJack)
  if (typeof opts.explicit === "boolean") {
    const until = opts.explicit ? freeUntilIso : null;
    return {
      isRefundable: opts.explicit,
      freeCancellationUntil: until,
      label: opts.explicit
        ? until
          ? `Free cancellation till ${fmtCxlDate(until)}`
          : "Refundable"
        : "Non-Refundable",
      unknown: false,
    };
  }

  // 2. Derive from cancellation policies (RateGain): a 0-amount window => refundable
  if (policies.length > 0) {
    if (freeWindow) {
      return {
        isRefundable: true,
        freeCancellationUntil: freeUntilIso,
        label: freeUntilIso ? `Free cancellation till ${fmtCxlDate(freeUntilIso)}` : "Refundable",
        unknown: false,
      };
    }
    // Every policy charges a penalty from the start => non-refundable
    return { isRefundable: false, freeCancellationUntil: null, label: "Non-Refundable", unknown: false };
  }

  // 3. Hard non-refundable signal in rate comments (RateGain)
  if (/NON[-\s]?REFUNDABLE/i.test(comments)) {
    return { isRefundable: false, freeCancellationUntil: null, label: "Non-Refundable", unknown: false };
  }

  // 4. No signal at all — conservative default, flagged unknown for the UI
  return { isRefundable: false, freeCancellationUntil: null, label: "Non-Refundable", unknown: true };
}

export function extractRGTaxes(taxObj: any, cur: string) {
  let inc = 0;
  let exc = 0;
  if (!taxObj) return { inc, exc };
  if (typeof taxObj === "number") return { inc: 0, exc: taxObj };
  if (typeof taxObj === "string") return { inc: 0, exc: Number(taxObj) || 0 };

  if (Array.isArray(taxObj.taxes)) {
    for (const t of taxObj.taxes) {
      if ((t.clientCurrency || cur) !== cur) continue;
      const amt = Number(t.clientAmount ?? (t.clientCurrency === cur ? t.amount : 0)) || 0;
      const isInc = t.included === true || t.included === "true" || t.included === 1 || taxObj.allIncluded === true;
      if (isInc) {
        inc += amt;
      } else {
        exc += amt;
      }
    }
  }
  return { inc, exc };
}

export function getRGRawPrice(rate: any): number {
  return Number(
    rate.RoomRate ??
    rate.totalAmount ??
    rate.sellingRate ??
    rate.totalRate ??
    rate.price ??
    rate.net ??
    rate.rate ??
    rate.totalPrice ??
    rate.netPrice ??
    rate.displayRatePerNight ??
    rate.lowestRate ??
    rate.roomRates?.[0]?.totalAmount ??
    rate.options?.[0]?.price ??
    0
  );
}

export function enrichRateGainPrice(
  rate: any,
  markupRules: MarkupRule[],
  nights: number,
  fallbackCurrency: string
) {
  if (rate.__enriched) return rate;

  // Supplier total is AUTHORITATIVE (== cancellation liability == what we'll be invoiced)
  const supplierTotal = round2(getRGRawPrice(rate));
  const cur = rate.currency || fallbackCurrency || "INR";

  const taxDet = extractRGTaxes(rate.taxes, cur);
  let taxAmount = taxDet.inc + taxDet.exc;

  if (taxAmount === 0) {
    taxAmount = Number(rate.taxAmount || rate.totalTax || rate.tax || rate.taxesAndFees || 0);
  }
  taxAmount = round2(taxAmount);

  const supplierBase = round2(supplierTotal - taxAmount);
  // Platform (super-admin) markup is baked into the net the agent sees ("api price").
  const base = applyPlatformMarkup(supplierBase);
  const total = round2(base + taxAmount);

  const enriched = calculateEnrichedPricing(
    { basePrice: base, totalPrice: total, taxes: taxAmount, mf: 0, mft: 0, currency: cur },
    markupRules, nights
  );

  // Refundable status derived once, server-side (RG has no explicit flag)
  const refundable = deriveRefundable({
    cancellationPolicies: rate.cancellationPolicies,
    rateComments: rate.rateComments,
  });

  return {
    ...rate,
    __enriched: true,
    isRefundable: refundable.isRefundable,
    refundableLabel: refundable.label,
    freeCancellationUntil: refundable.freeCancellationUntil,
    price: round2(enriched.finalTotalPrice),
    netPrice: base,
    pricing: {
      totalPrice: total,
      taxes: taxAmount,
      currency: cur,
      ...enriched,
      markupAmount: round2(enriched.markupAmount),
      perNightPrice: round2(enriched.perNightPrice),
      supplierTotalPrice: round2(enriched.supplierTotalPrice),
      finalTotalPrice: round2(enriched.finalTotalPrice)
    }
  };
}
