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
  checkout: string | undefined
): number {
  try {
    if (!checkin || !checkout) return 1;
    const diff =
      new Date(checkout).getTime() - new Date(checkin).getTime();
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
  nights: number
): EnrichedPricing {
  const { basePrice, totalPrice, taxes, mf, mft, currency: _currency } = input;

  // --- markup resolution ---
  const rule = markupRules.find(
    (r) =>
      r.serviceType.toUpperCase() === 'HOTELS' ||
      r.serviceType.toUpperCase() === 'HOTEL'
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
