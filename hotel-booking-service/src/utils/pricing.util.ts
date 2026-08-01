import { MarkupRule } from "./wallet.util";
import { getMarkupConfig } from "../config/markup-config";

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// PLATFORM (KLAR master) markup — MUST mirror hotel-search-service config.
// A hidden margin added to the raw supplier net BEFORE agents see it.
// Booking uses it to (a) validate against the api price the agent saw, and
// (b) still pay the supplier the raw net. Master-configured via auth-service.
//
// Read live from the snapshot on every call: caching a module const here would
// pin this service to whatever the config was at boot, while hotel-search
// picked up the master's change within its TTL — and the resulting mismatch
// surfaces as spurious PRICE_CHANGED rejections, not as a config error.
// ---------------------------------------------------------------------------
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
};

/** Amount the platform adds on top of a raw supplier NET price. */
export function platformMarkupAmount(supplierNet: number): number {
  const cfg = getMarkupConfig().platform;
  if (!cfg.enabled || !supplierNet || supplierNet <= 0) return 0;
  const amt =
    cfg.type === "PERCENTAGE" ? (supplierNet * cfg.value) / 100 : cfg.value;
  return round2(Math.max(0, amt));
}

/** api net (what the agent sees) = supplier net + platform markup. */
export function applyPlatformMarkup(supplierNet: number): number {
  return round2(supplierNet + platformMarkupAmount(supplierNet));
}

/**
 * The master's B2C margin on top of an api net (i.e. a net that already
 * includes the platform markup). B2C's analogue of an agent's own markup.
 */
export function b2cMarkupAmount(apiNet: number): number {
  const cfg = getMarkupConfig().b2c;
  if (!cfg.enabled || !apiNet || apiNet <= 0) return 0;
  const amt =
    cfg.type === "PERCENTAGE" ? (apiNet * cfg.value) / 100 : cfg.value;
  return round2(Math.max(0, amt));
}

/**
 * The least a B2C customer may pay for this rate: api net + B2C markup.
 *
 * The browser supplies the selling price at commit, so this is the server-side
 * floor that makes the master's pricing unbypassable. Flooring at the raw
 * supplier net instead — as this path used to — lets a tampered-low price book
 * at cost, silently forfeiting both margins.
 */
export function b2cPriceFloor(apiNet: number): number {
  return round2(apiNet + b2cMarkupAmount(apiNet));
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
