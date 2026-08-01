import crypto from "crypto";
import { SupplierAdapter, PrecheckResultV1 } from "../models/PrecheckResult";
import { rateGainProvider } from "../providers/rategain.provider";
import { CircuitBreaker } from "../services/CircuitBreaker";
import { applyPlatformMarkup } from "../utils/pricing.util";
import { refreshMarkupConfig } from "../config/markup-config";

const rateGainCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures -> Open for 30s

export class RateGainAdapter implements SupplierAdapter {
  async precheck(payload: any): Promise<PrecheckResultV1> {
    // See TripJackAdapter.precheck — same guarantee, same reason.
    await refreshMarkupConfig();

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
        preCheckRoom?.name || option.RoomName || option.RoomTypeCode || "";
      const mealPlan = option.BoardName || option.boardName || "";
      const cancellationPolicy = JSON.stringify(
        option.CancellationPolicy ||
          option.CancelPolicy ||
          option.cancellationPolicies ||
          {},
      );
      const occupancy = option.NumberOfAdults || option.adults || 2;

      const rawPrice =
        option.RoomRate ||
        option.totalAmount ||
        option.sellingRate ||
        option.totalRate ||
        option.price ||
        option.net ||
        option.rate ||
        option.totalPrice ||
        option.netPrice ||
        option.displayRatePerNight ||
        option.lowestRate ||
        option.Pricing?.TotalPrice ||
        0;

      const supplierTotal = Number(rawPrice);

      const cur =
        rgRes?.body?.CurrencyCode ||
        rgRes?.CurrencyCode ||
        rgRes?.BookReservation?.CurrencyCode ||
        rgRes?.body?.preCheckResponse?.currency ||
        option.currency ||
        "INR";

      let inc = 0;
      let exc = 0;
      const taxObj = option.taxes;

      if (taxObj && Array.isArray(taxObj.taxes)) {
        taxObj.taxes.forEach((t: any) => {
          if ((t.clientCurrency || cur) !== cur) return;
          const amt =
            Number(
              t.clientAmount ?? (t.clientCurrency === cur ? t.amount : 0),
            ) || 0;
          const isInc =
            t.included === true ||
            t.included === "true" ||
            t.included === 1 ||
            taxObj.allIncluded === true;
          if (isInc) {
            inc += amt;
          } else {
            exc += amt;
          }
        });
      }

      let taxAmount = inc + exc;
      if (taxAmount === 0) {
        taxAmount = Number(
          option.Tax ||
            option.Pricing?.TotalTax ||
            option.taxAmount ||
            option.totalTax ||
            option.taxes ||
            option.taxesAndFees ||
            0,
        );
      }

      // Base price for validation engine (which sums price + taxes to equal supplierTotal)
      const taxes = Math.round(taxAmount * 100) / 100;
      const supplierBase = Math.round((supplierTotal - taxes) * 100) / 100;
      // Raw amount to pay the supplier (net + taxes, EXCLUDES platform markup)
      const supplierNet = Math.round(supplierTotal * 100) / 100;
      // Platform (super-admin) markup baked into the net we validate/charge ("api price")
      const price = applyPlatformMarkup(supplierBase);

      // RateGain MSP (min selling price) for the B2C Net+Commission model (spec v1.5.3).
      const rawSellingRate = Number(
        option.sellingRate ??
          rgRes?.body?.preCheckResponse?.sellingRate ??
          rgRes?.body?.sellingRate ??
          0,
      );
      const sellingRate =
        rawSellingRate > 0 ? Math.round(rawSellingRate * 100) / 100 : undefined;

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
        supplierNet,
        sellingRate,
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
