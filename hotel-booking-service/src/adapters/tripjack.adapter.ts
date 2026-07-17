import crypto from "crypto";
import { SupplierAdapter, PrecheckResultV1 } from "../models/PrecheckResult";
import { tripJackProvider } from "../providers/tripjack.provider";
import { CircuitBreaker } from "../services/CircuitBreaker";
import { applyPlatformMarkup } from "../utils/pricing.util";
import { refreshMarkupConfig } from "../config/markup-config";

const tripJackCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures -> Open for 30s

export class TripJackAdapter implements SupplierAdapter {
  async precheck(payload: any): Promise<PrecheckResultV1> {
    // Every pricing path in this service funnels through precheck, so this is
    // the one place that has to guarantee `applyPlatformMarkup` below reads a
    // current snapshot rather than boot-time env defaults. Never throws, and
    // is a no-op once warm.
    await refreshMarkupConfig();

    return tripJackCircuitBreaker.execute(async () => {
      // Call existing provider
      const tjRes = await tripJackProvider.precheck(payload);

      const data = tjRes.body;
      const option =
        data?.hotel?.ops?.[0] || data?.option || data?.hInfo?.ops?.[0];

      if (!option) {
        throw new Error("No option found in TripJack precheck response.");
      }

      const roomType = option.ris?.[0]?.rt || option.roomType || "";
      const mealPlan = option.ris?.[0]?.mb || option.mealPlan || "";
      const cancellationPolicy = JSON.stringify(
        option.cnp || option.cancellationPolicy || {},
      );
      const occupancy = option.ris?.[0]?.adt || option.occupancy || 2;

      // The v3 review response (`hInfo.ops[0]`) exposes `tp` as an all-in total:
      // base + taxes + management fees. It carries no tax breakdown, so `taxes`
      // stays 0 and `price` alone must account for the whole amount.
      //
      // ValidationEngine compares `price + taxes` against what the agent saw, so
      // reporting a non-zero `taxes` here on top of an all-in `tp` would
      // double-count the tax and reject valid bookings as PRICE_CHANGED.
      const rawPrice = Number(
        option.tp ?? option.pricing?.totalPrice ?? option.totalPrice ?? 0,
      );
      const taxes = 0;
      // Raw amount to pay the supplier (EXCLUDES platform markup).
      const supplierNet = Math.round(rawPrice * 100) / 100;
      // Platform (super-admin) markup baked into the net we validate/charge ("api price")
      const price = applyPlatformMarkup(rawPrice);
      const currency = "INR";

      // Generate hash of cancellation policy
      const cancellationPolicyHash = crypto
        .createHash("sha256")
        .update(cancellationPolicy)
        .digest("hex");

      return {
        available: data.status?.success !== false,
        roomType,
        mealPlan,
        cancellationPolicyHash,
        occupancy,
        optionId: option.id || option.optionId || tjRes.optionId,
        price,
        taxes,
        supplierNet,
        currency,
        originalResponse: tjRes,
      };
    });
  }
}

export const tripJackAdapter = new TripJackAdapter();
