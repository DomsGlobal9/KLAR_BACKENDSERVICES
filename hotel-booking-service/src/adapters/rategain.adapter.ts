import crypto from "crypto";
import { SupplierAdapter, PrecheckResultV1 } from "../models/PrecheckResult";
import { rateGainProvider } from "../providers/rategain.provider";
import { CircuitBreaker } from "../services/CircuitBreaker";

const rateGainCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures -> Open for 30s

export class RateGainAdapter implements SupplierAdapter {
  async precheck(payload: any): Promise<PrecheckResultV1> {
    return rateGainCircuitBreaker.execute(async () => {
      // Call existing provider
      const rgRes = await rateGainProvider.precheck(payload);

      const preCheckRoom = rgRes?.body?.preCheckResponse?.rooms?.[0];
      const preCheckRate = preCheckRoom?.rates?.[0];

      const option =
        rgRes?.body?.RoomSelection?.[0] ||
        rgRes?.RoomSelection?.[0] ||
        rgRes?.BookReservation?.RoomSelection?.[0] ||
        preCheckRate;

      if (!option) {
        console.error(
          "[RateGain] Precheck raw response:",
          JSON.stringify(rgRes, null, 2),
        );
        throw new Error(
          `No option found in RateGain precheck response. Raw: ${JSON.stringify(rgRes)}`,
        );
      }

      const roomType =
        option.RoomTypeCode || option.RoomName || preCheckRoom?.name || "";
      const mealPlan = option.BoardName || option.boardName || "";
      const cancellationPolicy = JSON.stringify(
        option.CancellationPolicy ||
          option.CancelPolicy ||
          option.cancellationPolicies ||
          {},
      );
      const occupancy = option.NumberOfAdults || option.adults || 2;

      const price =
        option.RoomRate ||
        option.Pricing?.TotalPrice ||
        option.price ||
        option.totalPrice ||
        0;

      let taxes = 0;
      if (option.taxes?.taxes && Array.isArray(option.taxes.taxes)) {
        taxes = option.taxes.taxes.reduce(
          (sum: number, t: any) =>
            sum + (Number(t.clientAmount || t.amount) || 0),
          0,
        );
      } else {
        taxes = Number(
          option.Tax ||
            option.Pricing?.TotalTax ||
            option.taxAmount ||
            option.totalTax ||
            option.taxes ||
            0,
        );
      }

      const currency =
        rgRes?.body?.CurrencyCode ||
        rgRes?.CurrencyCode ||
        rgRes?.BookReservation?.CurrencyCode ||
        rgRes?.body?.preCheckResponse?.currency ||
        "INR";

      const phone = rgRes?.body?.preCheckResponse?.phone || rgRes?.phone || "";
      const rateComments = option.rateComments || option.RateComments || "";
      const paymentType = option.paymentType || option.PaymentType || "";

      // Generate hash of cancellation policy
      const cancellationPolicyHash = crypto
        .createHash("sha256")
        .update(cancellationPolicy)
        .digest("hex");

      return {
        available:
          rgRes?.body?.ResStatus === 1 ||
          rgRes?.status === "success" ||
          rgRes?.status === true ||
          rgRes?.BookReservation?.ResStatus === 1 ||
          true,
        roomType,
        mealPlan,
        cancellationPolicyHash,
        occupancy,
        optionId:
          option.RoomSelectionKey || option.optionId || option.rateKey || "",
        price,
        taxes,
        currency,
        phone,
        rateComments,
        paymentType,
        originalResponse: rgRes,
      };
    });
  }
}

export const rateGainAdapter = new RateGainAdapter();
