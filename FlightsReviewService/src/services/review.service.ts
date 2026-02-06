import { tripJackClient } from "../clients/tripjack.client";
import { validateReviewResponse } from "../validators/review.validator";
import { mapReviewResponse } from "../mappers/review.mapper";
import { RevalidateInput, RevalidateResult, FareChange } from "../types/review.types";

export class ReviewService {
  /**
   * Review flight before booking
   * Gets fare details, booking conditions, and SSR options
   */
  async review(payload: any) {
    const response = await tripJackClient.review(payload);

    validateReviewResponse(response);

    const fareAlert = response.alerts?.find(
      (a: any) => a.type === "FAREALERT"
    );

    if (fareAlert) {
      const difference = fareAlert.newFare - fareAlert.oldFare;
      const percentageChange = ((difference / fareAlert.oldFare) * 100).toFixed(2);

      return {
        fareChange: {
          oldFare: fareAlert.oldFare,
          newFare: fareAlert.newFare,
          difference,
          percentageChange: parseFloat(percentageChange)
        }
      };
    }

    return mapReviewResponse(response);
  }

  /**
   * Revalidate fare before final booking
   * Ensures price hasn't changed since review
   */
  async revalidate(input: RevalidateInput): Promise<RevalidateResult> {
    try {
      const response = await tripJackClient.revalidate({
        reviewId: input.reviewId
      });

      // Check if fare is still valid
      const fareAlert = response.alerts?.find(
        (a: any) => a.type === "FAREALERT"
      );

      if (fareAlert) {
        const difference = fareAlert.newFare - fareAlert.oldFare;
        const percentageChange = ((difference / fareAlert.oldFare) * 100).toFixed(2);

        return {
          success: false,
          fareValid: false,
          fareChange: {
            oldFare: fareAlert.oldFare,
            newFare: fareAlert.newFare,
            difference,
            percentageChange: parseFloat(percentageChange)
          },
          message: `Fare has changed. New fare: ${fareAlert.newFare}, Old fare: ${fareAlert.oldFare}`
        };
      }

      // Fare is still valid
      return {
        success: true,
        fareValid: true,
        price: response.totalPriceInfo ? {
          totalFare: response.totalPriceInfo.totalFareDetail.fC.TF,
          baseFare: response.totalPriceInfo.totalFareDetail.fC.BF,
          taxes: response.totalPriceInfo.totalFareDetail.fC.TAF,
          currency: response.totalPriceInfo.totalFareDetail.fC.currency || "INR"
        } : undefined,
        message: "Fare is valid and unchanged"
      };
    } catch (error: any) {
      console.error("Revalidate error:", error);

      return {
        success: false,
        fareValid: false,
        message: error.message || "Failed to revalidate fare"
      };
    }
  }
}

export const reviewService = new ReviewService();
