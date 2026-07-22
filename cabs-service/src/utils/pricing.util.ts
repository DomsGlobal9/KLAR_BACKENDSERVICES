/**
 * Server-side cab pricing.
 *
 * WHY THIS EXISTS
 * ---------------
 * Cabs had no markup system. The customer-facing gross was taken from the
 * request body (`pricingInfo.grossAmount`) and the margin was whatever the
 * client put in `pricingInfo.agentMarkup`. The only price guard, in
 * ValidationEngine, blocks a supplier price INCREASE beyond tolerance:
 *
 *     if (freshTotal > expectedPrice + allowed) throw PRICE_CHANGED
 *
 * Nothing rejects a gross that is too LOW. A caller could send
 * grossAmount === the bare supplier net and pay no margin at all, and the
 * booking would complete normally with markupAmount computed as zero.
 *
 * So the gross is computed here, from the supplier's fresh fare plus the
 * master's and the agent's configured rules. The client's number is compared
 * (so a genuine quote-vs-charge divergence is visible) but never used.
 *
 * The stacking mirrors hotels exactly:
 *
 *   supplier net --(+platform)--> api net (what the agent sees)
 *                --(+agent | +b2c)--> gross (what the customer pays)
 *
 * B2B adds the agent's own margin on top of the api net; B2C adds the master's
 * B2C rule instead. There is no agent on the B2C channel, so nothing else would
 * occupy that slot — and a B2C caller's own token must never contribute rules.
 */

import { getMarkupConfig, ResolvedMarkup } from "../config/markup-config";
import { MarkupRegion } from "./region.util";
import { MarkupRule } from "./wallet.util";

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Amount a FIXED/PERCENTAGE rule adds to `base`. Never negative. */
export function markupAmountFor(base: number, rule: ResolvedMarkup): number {
  if (!rule?.enabled || !base || base <= 0 || rule.value <= 0) return 0;
  const amt = rule.type === "PERCENTAGE" ? (base * rule.value) / 100 : rule.value;
  return round2(Math.max(0, amt));
}

/** Amount the platform adds on top of a raw supplier NET price. */
export function platformMarkupAmount(
  supplierNet: number,
  region: MarkupRegion = "ALL",
): number {
  return markupAmountFor(supplierNet, getMarkupConfig(region).platform);
}

/** api net (what a B2B agent sees) = supplier net + platform markup. */
export function applyPlatformMarkup(
  supplierNet: number,
  region: MarkupRegion = "ALL",
): number {
  return round2(supplierNet + platformMarkupAmount(supplierNet, region));
}

/** Amount an agent's own rule adds. Rules are pre-narrowed to the region. */
export function agentMarkupAmount(apiNet: number, rules: MarkupRule[]): number {
  const rule = (rules ?? []).find(
    (r) => (r.serviceType || "").toUpperCase() === "CABS",
  );
  if (!rule || !apiNet || apiNet <= 0) return 0;

  const pct = Number(rule.percentageMarkup) || 0;
  const fixed = Number(rule.fixedMarkup) || 0;

  // The model enforces "add only one", but a legacy row could carry both;
  // summing is the behaviour that never silently drops a configured margin.
  return round2(Math.max(0, (apiNet * pct) / 100 + fixed));
}

export interface CabPriceBreakdown {
  /** What the supplier is owed. Never includes any Klar margin. */
  supplierNet: number;
  platformMarkup: number;
  /** supplierNet + platformMarkup — the "api price" a B2B agent perceives. */
  apiNet: number;
  /** The agent's own margin (B2B) or the master's B2C margin (B2C). */
  channelMarkup: number;
  /** What the customer pays. */
  gross: number;
  /** Total Klar margin = gross - supplierNet. */
  markupAmount: number;
  region: MarkupRegion;
}

/**
 * Computes the customer-facing price for a cab from the supplier's fresh fare.
 *
 * `supplierNet` MUST be the freshly validated supplier total (fare + taxes) —
 * never a number from the request body.
 */
export function calculateCabPrice(args: {
  supplierNet: number;
  clientType: string | undefined;
  agentRules: MarkupRule[];
  region?: MarkupRegion;
}): CabPriceBreakdown {
  const region = args.region ?? "ALL";
  const supplierNet = round2(Math.max(0, Number(args.supplierNet) || 0));
  const isB2B = (args.clientType || "").toUpperCase() === "B2B";

  const platformMarkup = platformMarkupAmount(supplierNet, region);
  const apiNet = round2(supplierNet + platformMarkup);

  const channelMarkup = isB2B
    ? agentMarkupAmount(apiNet, args.agentRules)
    : markupAmountFor(apiNet, getMarkupConfig(region).b2c);

  const gross = round2(apiNet + channelMarkup);

  return {
    supplierNet,
    platformMarkup,
    apiNet,
    channelMarkup,
    gross,
    markupAmount: round2(gross - supplierNet),
    region,
  };
}
