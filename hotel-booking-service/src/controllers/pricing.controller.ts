import { Request, Response } from "express";
import { PricingUtil, applyPlatformMarkup, platformMarkupAmount } from "../utils/pricing.util";
import { resolveMarkupRules } from "../utils/wallet.util";
import { convertToINR } from "../utils/fx.util";
import { precheckService } from "../services/precheck.service";
import { refreshMarkupConfig } from "../config/markup-config";

export const getPricingSummaryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { rooms, searchParams, hotelCurrency, additionalMarkup, couponCode } =
      req.body;

    if (!rooms || !Array.isArray(rooms)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid rooms array is required" });
    }

    // This endpoint is agent-facing, and it reaches past the supplier adapters
    // to the raw provider (below) — so nothing here has the platform markup
    // applied for us. Refresh the snapshot before we add it by hand.
    await refreshMarkupConfig();

    // ─── Step 1: Call TripJack precheck to get the TRUE price ───────────────
    // This is the ONLY source of truth for TripJack hotels.
    // No frontend room price summing allowed.
    let providerNetPrice = 0;
    let precheckBreakdown: any = null;
    let precheckBookingId: string | null = null;

    const isTripJack = (
      searchParams?.hotelId ||
      searchParams?.propertyId ||
      ""
    ).startsWith("TJ:");

    if (
      isTripJack &&
      searchParams?.optionId &&
      searchParams?.reviewHash &&
      searchParams?.correlationId
    ) {
      try {
        const precheckPayload = {
          optionId: searchParams.optionId,
          reviewHash: searchParams.reviewHash,
          correlationId: searchParams.correlationId,
          hid: searchParams.hid,
          propertyId: searchParams.hotelId || searchParams.propertyId,
        };

        console.log(
          "[PricingSummary] Calling TripJack precheck for true price...",
          precheckPayload.optionId,
        );
        const precheckRes = await precheckService.precheck(precheckPayload);

        if (precheckRes.status && precheckRes.body?.hotel?.ops?.[0]) {
          const pricing = precheckRes.body.hotel.ops[0];
          // TripJack pricing structure: tp (total price), mf (management fee), mft (management fee tax), bf (base fare)
          const supplierNet = Number(pricing.tp || pricing.totalPrice || 0);
          precheckBookingId = precheckRes.bookingId || null;

          // Everything below this line is agent-visible and must be expressed
          // in "api price" terms — supplier net + platform markup. This call
          // goes to the raw provider rather than TripJackAdapter, so unlike
          // every other pricing path it does not get the markup applied for
          // free. Returning `pricing.tp` here as `netPrice` would hand the
          // agent the raw supplier price, and diffing it against the search
          // result discloses the master's markup exactly.
          providerNetPrice = applyPlatformMarkup(supplierNet);

          const supplierBase =
            Number(pricing.bf || pricing.basePrice || 0) ||
            supplierNet - (pricing.mf || 0) - (pricing.mft || 0);

          precheckBreakdown = {
            totalPrice: providerNetPrice,
            // The markup rides on the base, so the breakdown still reconciles
            // to totalPrice (base + mf + mft) and nothing hints at the delta.
            basePrice: applyPlatformMarkup(supplierBase),
            mf: Number(pricing.mf || 0),
            mft: Number(pricing.mft || 0),
          };

          console.log(
            `[PricingSummary] TripJack supplier net: ₹${supplierNet}, api price: ₹${providerNetPrice} (platform markup ₹${platformMarkupAmount(supplierNet)})`,
            precheckBreakdown,
          );
        } else {
          throw new Error("Precheck returned no pricing data");
        }
      } catch (err: any) {
        console.error(
          "[PricingSummary] TripJack precheck failed:",
          err.message,
        );
        return res.status(502).json({
          success: false,
          message: `Could not fetch live price from provider: ${err.message}. Please go back and re-select the room.`,
        });
      }
    } else {
      // ─── RateGain / Fallback: sum room prices sent by frontend ──────────
      // Live FX via fx.util (cached, env-overridable). A missing rate throws
      // rather than silently converting 1:1, so we never mis-price a foreign
      // stay — we return a clear error and let the user retry.
      try {
        for (const room of rooms) {
          if (room.netPriceInINR !== undefined) {
            providerNetPrice += Number(room.netPriceInINR);
          } else {
            providerNetPrice += await convertToINR(
              Number(room.price || 0),
              hotelCurrency || "INR",
            );
          }
        }
      } catch (fxErr: any) {
        return res.status(502).json({
          success: false,
          message:
            "Currency conversion is temporarily unavailable. Please try again shortly.",
        });
      }
    }

    if (providerNetPrice <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Provider returned zero price. Please re-select the room.",
        });
    }

    // ─── Step 2: Apply Klar Markup Rules on top of provider net price ────────
    // Channel-aware: B2B gets the agent's own rules, B2C the master's B2C rule.
    // Using the agent-rule lookup for both (as this did) returns nothing on B2C
    // — there is no agent — so every B2C quote came back at the api net with
    // the master's margin silently dropped, while commit still demanded it.
    const clientType = (req as any).user?.clientType || "B2C";
    const isB2B = String(clientType).toUpperCase() === "B2B";
    const markupRules = await resolveMarkupRules(clientType, token);

    // `additionalMarkup` is the agent's own margin, entered in the B2B UI. On
    // B2C there is no agent to set one, and honouring a caller-supplied value
    // here would let a customer price their own booking — including below our
    // floor with a negative number.
    const appliedAdditionalMarkup = isB2B ? Number(additionalMarkup) || 0 : 0;

    let { total, markup, adminMarkup, net } =
      PricingUtil.calculatePriceWithMarkup(
        providerNetPrice,
        markupRules,
        appliedAdditionalMarkup,
        couponCode,
      );

    // Enforce B2C RateGain Minimum Selling Price (MSP) if mandatory
    if (clientType === "B2C") {
      let mspRequired = 0;
      let enforceMsp = false;
      for (const room of rooms) {
        if (room.isMandatory || room.IsMandatory) {
          enforceMsp = true;
        }
        if (room.sellingRate || room.SellingRate) {
          mspRequired += Number(room.sellingRate || room.SellingRate);
        }
      }
      if (enforceMsp && total < mspRequired) {
        console.log(
          `[PricingSummary] Enforcing MSP: raising price from ₹${total} to ₹${mspRequired}`,
        );
        total = mspRequired;
        markup = total - net;
        adminMarkup = markup - appliedAdditionalMarkup;
      }
    }

    // UI Matching Rounding Logic removed per Package-Based Selection requirements

    console.log(
      `[PricingSummary] Final: net=₹${net}, adminMarkup=₹${adminMarkup}, total=₹${total}`,
    );

    return res.json({
      success: true,
      data: {
        netPrice: net, // Provider's price (what we pay TripJack)
        totalPrice: total, // What the agent pays (net + markup)
        adminMarkup, // Klar's admin markup
        additionalMarkup: appliedAdditionalMarkup,
        totalMarkup: markup,
        taxes: 0, // TripJack includes taxes in totalPrice
        breakdown: precheckBreakdown, // mf, mft, basePrice from TripJack
        precheckBookingId, // Forward to frontend to cache for commit
      },
    });
  } catch (error: any) {
    console.error("Pricing Summary Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to calculate pricing summary" });
  }
};
