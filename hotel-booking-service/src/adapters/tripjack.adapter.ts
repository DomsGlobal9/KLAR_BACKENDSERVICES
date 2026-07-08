import crypto from "crypto";
import { SupplierAdapter, PrecheckResultV1 } from "../models/PrecheckResult";
import { tripJackProvider } from "../providers/tripjack.provider";
import { CircuitBreaker } from "../services/CircuitBreaker";
import { applyPlatformMarkup } from "../utils/pricing.util";

const tripJackCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures -> Open for 30s

export class TripJackAdapter implements SupplierAdapter {
  async precheck(payload: any): Promise<PrecheckResultV1> {
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

      const rawPrice = Number(
        option.tp || option.pricing?.totalPrice || option.totalPrice || 0,
      );
      const taxes = Number(
        option.tf || option.pricing?.totalTax || option.totalTax || 0,
      );
      // Raw amount to pay the supplier (EXCLUDES platform markup) = existing price+taxes total
      const supplierNet = Math.round((rawPrice + taxes) * 100) / 100;
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
