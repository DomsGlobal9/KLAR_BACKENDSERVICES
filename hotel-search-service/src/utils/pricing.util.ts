/**
 * pricing.util.ts
 * Pure utility — no I/O, no side-effects.
 * Centralises all hotel pricing & markup computation for hotel-search-service.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface MarkupRule {
  serviceType: string;
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

  let markupAmount = 0;
  if (rule) {
    if (rule.percentageMarkup > 0) {
      markupAmount = (totalPrice * rule.percentageMarkup) / 100;
    } else if (rule.fixedMarkup > 0) {
      markupAmount = rule.fixedMarkup;
    }
  }

  // --- derived totals ---
  const supplierTotalPrice = totalPrice;
  const finalTotalPrice = totalPrice + markupAmount;
  const safeNights = nights >= 1 ? nights : 1;
  const perNightPrice = basePrice / safeNights;

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

  // 2. Hard non-refundable signal in rate comments (RateGain)
  if (/NON[-\s]?REFUNDABLE/i.test(comments)) {
    return { isRefundable: false, freeCancellationUntil: null, label: "Non-Refundable", unknown: false };
  }

  // 3. Derive from cancellation policies (RateGain): a 0-amount window => refundable
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

  const total = supplierTotal; // <-- NOT supplierTotal + excludedTax
  const base = round2(supplierTotal - taxAmount);

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
