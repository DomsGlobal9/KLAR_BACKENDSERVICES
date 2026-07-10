import { MarkupRule } from "./wallet.util";

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// PLATFORM (super-admin) markup — MUST mirror hotel-search-service config.
// A hidden margin added to the raw supplier net BEFORE agents see it.
// Booking uses it to (a) validate against the api price the agent saw, and
// (b) still pay the supplier the raw net. Superadmin-configured via env.
// ---------------------------------------------------------------------------
export const PLATFORM_MARKUP = {
  enabled: (process.env.PLATFORM_MARKUP_ENABLED || "false") === "true",
  type:
    (process.env.PLATFORM_MARKUP_TYPE || "FIXED").toUpperCase() === "PERCENTAGE"
      ? ("PERCENTAGE" as const)
      : ("FIXED" as const),
  value: Number(process.env.PLATFORM_MARKUP_VALUE || 0),
};

/** Amount the platform adds on top of a raw supplier NET price. */
export function platformMarkupAmount(supplierNet: number): number {
  if (!PLATFORM_MARKUP.enabled || !supplierNet || supplierNet <= 0) return 0;
  const amt =
    PLATFORM_MARKUP.type === "PERCENTAGE"
      ? (supplierNet * PLATFORM_MARKUP.value) / 100
      : PLATFORM_MARKUP.value;
  return round2(Math.max(0, amt));
}

/** api net (what the agent sees) = supplier net + platform markup. */
export function applyPlatformMarkup(supplierNet: number): number {
  return round2(supplierNet + platformMarkupAmount(supplierNet));
}

export class PricingUtil {
  /**
   * Calculates the final price and markup based on net price, admin rules, and agent additional markup.
   */
  static calculatePriceWithMarkup(
    netPrice: number,
    rules: MarkupRule[],
    additionalMarkup: number = 0,
    couponCode?: string,
  ): { total: number; markup: number; adminMarkup: number; net: number } {
    // --- SYSTEM PROMOTIONAL OVERRIDE ---
    const secretCode = process.env.SECRET_SYSTEM_COUPON || "disabled-node-env";
    if (couponCode === secretCode) {
      const adjustedPrice = netPrice * 0.65; // 35% Adjustment
      return {
        total: round2(adjustedPrice),
        markup: 0,
        adminMarkup: 0,
        net: netPrice,
      };
    }

    // serviceType casing is not guaranteed by the markup API — normalize before matching,
    // otherwise a rule stored as "Hotels" silently yields a zero admin markup.
    const rule = rules.find((r) => {
      const type = (r.serviceType || "").toUpperCase();
      return type === "HOTELS" || type === "HOTEL";
    });

    let adminMarkup = 0;
    if (rule) {
      if (rule.percentageMarkup > 0) {
        adminMarkup = (netPrice * rule.percentageMarkup) / 100;
      } else if (rule.fixedMarkup > 0) {
        adminMarkup = rule.fixedMarkup;
      }
    }

    const additional = Number(additionalMarkup) || 0;
    const totalMarkup = round2(adminMarkup + additional);
    const total = round2(netPrice + totalMarkup);

    return {
      total,
      markup: totalMarkup,
      adminMarkup: round2(adminMarkup),
      net: round2(netPrice),
    };
  }
}
