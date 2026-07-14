import { CabPrecheckResultV1 } from "../models/PrecheckResult";
import { StructuredError } from "./StructuredError";

/**
 * What the frontend claims it saw when the agent selected a cab. Used to detect
 * a supplier swap or price drift between search and book.
 */
export interface ExpectedCab {
  vehicleType?: string;
  vehicleCategory?: string;
  price?: number; // gross the agent was shown (all-in)
  cancellationPolicyHash?: string;
}

export interface PriceTolerance {
  fixed: number; // absolute currency units
  percent: number; // percent of expected price
}

function norm(s: string | undefined | null): string {
  return (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * Cabs equivalent of hotel-booking-service's ValidationEngine: compares a fresh
 * supplier precheck against what the agent expected and blocks the booking on
 * sold-out / vehicle-swap / policy-change / price-increase.
 */
export class ValidationEngine {
  /**
   * @returns the validated fresh total (price + taxes) to charge.
   * @throws StructuredError on any mismatch.
   */
  public static validate(
    expected: ExpectedCab | undefined,
    fresh: CabPrecheckResultV1,
    tolerance: PriceTolerance,
  ): { price: number } {
    if (!fresh.available) {
      throw new StructuredError(
        "VEHICLE_SOLD_OUT",
        "The selected cab is no longer available. Please search again.",
      );
    }

    if (expected) {
      // Vehicle identity (type + category). A genuine mismatch means the supplier
      // remapped us to a different vehicle — block so the customer is never
      // charged for a cab they did not choose. STRICT_VEHICLE_VALIDATION=false
      // downgrades this to a warning.
      const strict = process.env.STRICT_VEHICLE_VALIDATION !== "false";

      if (expected.vehicleType && fresh.vehicleType) {
        const e = norm(expected.vehicleType);
        const f = norm(fresh.vehicleType);
        if (e && f && !f.includes(e) && !e.includes(f)) {
          if (strict) {
            throw new StructuredError(
              "VEHICLE_CHANGED",
              "The cab offered no longer matches your selection. Please review and book again.",
              { expected: expected.vehicleType, fresh: fresh.vehicleType },
            );
          }
          console.warn(
            `[ValidationEngine] Vehicle type mismatch (non-strict). Expected: ${expected.vehicleType}, Fresh: ${fresh.vehicleType}`,
          );
        }
      }

      if (expected.vehicleCategory && fresh.vehicleCategory) {
        const e = norm(expected.vehicleCategory);
        const f = norm(fresh.vehicleCategory);
        if (e && f && e !== f && !f.includes(e) && !e.includes(f)) {
          if (strict) {
            throw new StructuredError(
              "VEHICLE_CHANGED",
              "The cab category offered no longer matches your selection. Please review and book again.",
              { expected: expected.vehicleCategory, fresh: fresh.vehicleCategory },
            );
          }
          console.warn(
            `[ValidationEngine] Vehicle category mismatch (non-strict). Expected: ${expected.vehicleCategory}, Fresh: ${fresh.vehicleCategory}`,
          );
        }
      }

      // Cancellation policy change is a soft signal — warn but never block, since
      // policy wording churns often and blocking would reject valid bookings.
      if (
        expected.cancellationPolicyHash &&
        fresh.cancellationPolicyHash &&
        expected.cancellationPolicyHash !== fresh.cancellationPolicyHash
      ) {
        console.warn(
          `[ValidationEngine] Cancellation policy changed since search for vehicle ${fresh.vehicleType}.`,
        );
      }
    }

    const freshTotal = Number(fresh.price || 0) + Number(fresh.taxes || 0);

    // Price drift: only an INCREASE beyond tolerance is blocked. A price drop is
    // fine — the customer just pays less.
    if (expected && expected.price !== undefined) {
      const expectedPrice = Number(expected.price);
      const allowed = Math.max(
        tolerance.fixed,
        expectedPrice * (tolerance.percent / 100),
      );
      if (freshTotal > expectedPrice + allowed) {
        throw new StructuredError(
          "PRICE_CHANGED",
          "The cab fare has increased beyond the allowed tolerance. Please review the new price.",
          { expectedPrice, freshPrice: freshTotal, currency: fresh.currency },
        );
      }
    }

    return { price: freshTotal };
  }
}
