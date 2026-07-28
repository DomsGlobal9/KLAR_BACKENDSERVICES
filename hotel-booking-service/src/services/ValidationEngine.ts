import crypto from "crypto";
import { PrecheckResultV1 } from "../models/PrecheckResult";

export class StructuredError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class ValidationEngine {
  private static createHash(data: any): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
  }

  private static getBookingFingerprint(result: PrecheckResultV1 | any): string {
    return this.createHash({
      roomType: result.roomType,
      mealPlan: result.mealPlan,
      occupancy: result.occupancy,
    });
  }

  private static getPolicyFingerprint(result: PrecheckResultV1 | any): string {
    return this.createHash({
      cancellationPolicyHash: result.cancellationPolicyHash,
    });
  }

  public static validate(
    expectedResult: any, // Could be derived from frontend payload
    freshResult: PrecheckResultV1,
    toleranceConfig: { fixed: number; percent: number },
  ): { price: number } {
    if (!freshResult.available) {
      throw new StructuredError(
        "ROOM_SOLD_OUT",
        "The requested room is no longer available.",
      );
    }

    // Compare booking fields individually if expected data is provided
    if (expectedResult) {
      if (expectedResult.roomType && freshResult.roomType) {
        // Strip non-alphanumeric and compare case-insensitive for leniency
        const normExpected = expectedResult.roomType
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase();
        const normFresh = freshResult.roomType
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase();

        // Allow partial match (e.g. "Standard Room" in "Standard Room Double").
        // A genuine mismatch means the supplier remapped us to a different room at
        // book time — block it so the customer is never charged for a room they
        // did not choose. STRICT_ROOM_VALIDATION=false downgrades this to a warning.
        if (
          normExpected &&
          normFresh &&
          !normFresh.includes(normExpected) &&
          !normExpected.includes(normFresh)
        ) {
          if (process.env.STRICT_ROOM_VALIDATION === "false") {
            console.warn(
              `[ValidationEngine] Room name mismatch (non-strict). Expected: ${expectedResult.roomType}, Fresh: ${freshResult.roomType}`,
            );
          } else {
            throw new StructuredError(
              "ROOM_CHANGED",
              "The room offered by the hotel no longer matches your selection. Please review and book again.",
              {
                expected: expectedResult.roomType,
                fresh: freshResult.roomType,
              },
            );
          }
        }
      }

      if (expectedResult.mealPlan && freshResult.mealPlan) {
        const normExpected = expectedResult.mealPlan
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase();
        const normFresh = freshResult.mealPlan
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase();
        if (
          normExpected &&
          normFresh &&
          normExpected !== normFresh &&
          !normFresh.includes(normExpected) &&
          !normExpected.includes(normFresh)
        ) {
          if (process.env.STRICT_ROOM_VALIDATION === "false") {
            console.warn(
              `[ValidationEngine] Meal plan mismatch (non-strict). Expected: ${expectedResult.mealPlan}, Fresh: ${freshResult.mealPlan}`,
            );
          } else {
            throw new StructuredError(
              "MEAL_PLAN_CHANGED",
              "The meal plan offered by the hotel no longer matches your selection. Please review and book again.",
              {
                expected: expectedResult.mealPlan,
                fresh: freshResult.mealPlan,
              },
            );
          }
        }
      }

      if (
        expectedResult.cancellationPolicyHash &&
        freshResult.cancellationPolicyHash
      ) {
        if (
          expectedResult.cancellationPolicyHash !==
          freshResult.cancellationPolicyHash
        ) {
          throw new StructuredError(
            "POLICY_CHANGED",
            "Supplier has modified the cancellation policy.",
            {
              expectedHash: expectedResult.cancellationPolicyHash,
              freshHash: freshResult.cancellationPolicyHash,
            },
          );
        }
      }
    }

    // Price comparison
    const totalFreshPrice =
      Number(freshResult.price || 0) + Number(freshResult.taxes || 0);

    if (expectedResult && expectedResult.price !== undefined) {
      const expectedPrice = Number(expectedResult.price);
      const tolerance = Math.max(
        toleranceConfig.fixed,
        expectedPrice * (toleranceConfig.percent / 100),
      );

      if (totalFreshPrice > expectedPrice + tolerance) {
        throw new StructuredError(
          "PRICE_CHANGED",
          "Supplier price has increased beyond allowed tolerance.",
          {
            expectedPrice,
            freshPrice: totalFreshPrice,
            currency: freshResult.currency,
          },
        );
      }
    }

    return { price: totalFreshPrice };
  }
}
