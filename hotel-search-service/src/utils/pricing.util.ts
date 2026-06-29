/**
 * pricing.util.ts
 * Pure utility — no I/O, no side-effects.
 * Centralises all hotel pricing, markup computation & currency conversion
 * for hotel-search-service.
 */

// ---------------------------------------------------------------------------
// Currency Conversion
// ---------------------------------------------------------------------------

// A simple default exchange rate dictionary.
// In a full production app, these would be fetched dynamically or heavily configured in env.
const FX_RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: Number(process.env.USD_TO_INR_RATE) || 85.5,
  EUR: Number(process.env.EUR_TO_INR_RATE) || 92.3,
  GBP: Number(process.env.GBP_TO_INR_RATE) || 108.4,
  AED: Number(process.env.AED_TO_INR_RATE) || 23.2,
};

/**
 * Detects the supplier currency from the RateGain rate object.
 * Checks taxes first as they are most explicit, then falls back to other fields.
 */
export function detectSupplierCurrency(rate: any): string {
  // 1. Check taxes explicitly (highly reliable)
  if (rate.taxes?.taxes?.[0]?.currency) {
    return rate.taxes.taxes[0].currency;
  }
  if (rate.taxes?.taxes?.[0]?.clientCurrency) {
    return rate.taxes.taxes[0].clientCurrency;
  }
  
  // 2. Check general rate currency fields
  return rate.currency || rate.Currency || rate.supplierCurrency || "USD"; // Default to USD if missing from RateGain
}

/**
 * Converts any known currency to INR based on configured FX rates.
 */
export function convertToINR(amount: number, fromCurrency: string): number {
  if (!fromCurrency || fromCurrency.toUpperCase() === "INR") return amount;
  
  const rate = FX_RATES_TO_INR[fromCurrency.toUpperCase()];
  if (!rate) {
    console.warn(`[Pricing] Unknown currency "${fromCurrency}" — returning amount as-is. Add to FX_RATES_TO_INR or set env var.`);
    return amount;
  }
  
  return Math.round(amount * rate * 100) / 100; // round to 2 decimal places
}

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
