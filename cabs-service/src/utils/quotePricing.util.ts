/**
 * Applies Klar's markup to the supplier's quote response.
 *
 * WHY SEARCH MUST DO THIS
 * -----------------------
 * booking.service now computes the customer-facing gross server-side. If search
 * kept returning the bare supplier fare, every booking would be quoted at net
 * and charged at net + markup — the customer would watch the price jump at the
 * last step. The quote and the charge have to be produced by the same rules,
 * so this reuses calculateCabPrice rather than reimplementing the arithmetic.
 *
 * WHAT IT TOUCHES
 * ---------------
 * The supplier payload sent at booking is rebuilt from a FRESH precheck
 * (booking.service step 2), never from this response, so rewriting the fare
 * here cannot corrupt what TripJack is asked to honour or paid.
 *
 * `fareBreakup.totalFare` is overwritten so existing clients display the right
 * number without a change, and the full breakdown is attached as `klarPricing`
 * for clients that want to show it.
 */

import { MarkupRegion } from "./region.util";
import { CabPriceBreakdown, calculateCabPrice, round2 } from "./pricing.util";
import { MarkupRule } from "./wallet.util";

/** TripJack: res.data.quotesInfo[].quotes[].fareBreakup */
export interface QuotePricingArgs {
  clientType: string | undefined;
  agentRules: MarkupRule[];
  region: MarkupRegion;
}

export interface QuotePricingSummary {
  quotesPriced: number;
  quotesSkipped: number;
}

/**
 * Marks up every quote in a TripJack quotes response, in place.
 *
 * Returns a summary rather than throwing on odd shapes: a quote we cannot price
 * is left at the supplier fare and counted, because dropping it would hide
 * inventory and marking it up blindly would invent a number.
 */
export function applyMarkupToQuotes(
  response: any,
  args: QuotePricingArgs,
): QuotePricingSummary {
  const groups: any[] = response?.data?.quotesInfo ?? [];
  let quotesPriced = 0;
  let quotesSkipped = 0;

  for (const group of Array.isArray(groups) ? groups : []) {
    for (const quote of Array.isArray(group?.quotes) ? group.quotes : []) {
      const fare = quote?.fareBreakup;
      const totalFare = Number(fare?.totalFare);
      const totalTax = Number(fare?.totalTax ?? 0);

      // The supplier NET is fare + tax, matching how precheck computes
      // freshTotal. Pricing on totalFare alone would mark up a smaller base
      // here than booking does and reintroduce the quote/charge gap.
      if (!fare || !Number.isFinite(totalFare) || totalFare <= 0) {
        quotesSkipped++;
        continue;
      }

      const supplierNet = round2(totalFare + (Number.isFinite(totalTax) ? totalTax : 0));

      const breakdown: CabPriceBreakdown = calculateCabPrice({
        supplierNet,
        clientType: args.clientType,
        agentRules: args.agentRules,
        region: args.region,
      });

      // Keep totalTax as the supplier reported it and carry the margin on
      // totalFare, so totalFare + totalTax still equals the customer's gross.
      fare.totalFare = round2(breakdown.gross - (Number.isFinite(totalTax) ? totalTax : 0));
      quote.klarPricing = breakdown;
      quotesPriced++;
    }
  }

  return { quotesPriced, quotesSkipped };
}
