import { Request, Response } from "express";
import { PricingUtil } from "../utils/pricing.util";
import { WalletUtil } from "../utils/wallet.util";
import { precheckService } from "../services/precheck.service";

export const getPricingSummaryController = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { rooms, searchParams, hotelCurrency, additionalMarkup, couponCode } = req.body;

        if (!rooms || !Array.isArray(rooms)) {
            return res.status(400).json({ success: false, message: "Valid rooms array is required" });
        }

        // ─── Step 1: Call TripJack precheck to get the TRUE price ───────────────
        // This is the ONLY source of truth for TripJack hotels.
        // No frontend room price summing allowed.
        let providerNetPrice = 0;
        let precheckBreakdown: any = null;
        let precheckBookingId: string | null = null;

        const isTripJack = (searchParams?.hotelId || searchParams?.propertyId || "").startsWith("TJ:");

        if (isTripJack && searchParams?.optionId && searchParams?.reviewHash && searchParams?.correlationId) {
            try {
                const precheckPayload = {
                    optionId: searchParams.optionId,
                    reviewHash: searchParams.reviewHash,
                    correlationId: searchParams.correlationId,
                    hid: searchParams.hid,
                    propertyId: searchParams.hotelId || searchParams.propertyId,
                };

                console.log("[PricingSummary] Calling TripJack precheck for true price...", precheckPayload.optionId);
                const precheckRes = await precheckService.precheck(precheckPayload);

                if (precheckRes.status && precheckRes.body?.option?.pricing) {
                    const pricing = precheckRes.body.option.pricing;
                    // TripJack pricing structure: tp (total price), mf (management fee), mft (management fee tax), bf (base fare)
                    providerNetPrice = Number(pricing.tp || pricing.totalPrice || 0);
                    precheckBookingId = precheckRes.bookingId || null;

                    precheckBreakdown = {
                        totalPrice: providerNetPrice,
                        basePrice: Number(pricing.bf || pricing.basePrice || 0) || (providerNetPrice - (pricing.mf || 0) - (pricing.mft || 0)),
                        mf: Number(pricing.mf || 0),
                        mft: Number(pricing.mft || 0),
                    };

                    console.log(`[PricingSummary] TripJack TRUE price: ₹${providerNetPrice}`, precheckBreakdown);
                } else {
                    throw new Error("Precheck returned no pricing data");
                }
            } catch (err: any) {
                console.error("[PricingSummary] TripJack precheck failed:", err.message);
                return res.status(502).json({
                    success: false,
                    message: `Could not fetch live price from provider: ${err.message}. Please go back and re-select the room.`,
                });
            }
        } else {
            // ─── RateGain / Fallback: sum room prices sent by frontend ──────────
            // Mock FX conversion — replace with a real FX service
            const FX_RATES: { [key: string]: number } = {
                'INR': 1, 'USD': 83, 'EUR': 90, 'GBP': 105, 'AED': 22, 'THB': 2.3,
            };
            const toINR = (amount: number, currency: string = 'INR') =>
                amount * (FX_RATES[currency.toUpperCase()] || 1);

            for (const room of rooms) {
                providerNetPrice += room.netPriceInINR !== undefined
                    ? Number(room.netPriceInINR)
                    : toINR(Number(room.price || 0), hotelCurrency || 'INR');
            }
        }

        if (providerNetPrice <= 0) {
            return res.status(400).json({ success: false, message: "Provider returned zero price. Please re-select the room." });
        }

        // ─── Step 2: Apply Klar Markup Rules on top of provider net price ────────
        const markupRules = await WalletUtil.getMarkupRules(token);
        let { total, markup, adminMarkup, net } = PricingUtil.calculatePriceWithMarkup(
            providerNetPrice,
            markupRules,
            Number(additionalMarkup) || 0,
            couponCode
        );

        // UI Matching Rounding Logic removed per Package-Based Selection requirements

        console.log(`[PricingSummary] Final: net=₹${net}, adminMarkup=₹${adminMarkup}, total=₹${total}`);

        return res.json({
            success: true,
            data: {
                netPrice: net,            // Provider's price (what we pay TripJack)
                totalPrice: total,        // What the agent pays (net + markup)
                adminMarkup,              // Klar's admin markup
                additionalMarkup: Number(additionalMarkup) || 0,
                totalMarkup: markup,
                taxes: 0,                 // TripJack includes taxes in totalPrice
                breakdown: precheckBreakdown,       // mf, mft, basePrice from TripJack
                precheckBookingId,                  // Forward to frontend to cache for commit
            }
        });

    } catch (error: any) {
        console.error("Pricing Summary Error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to calculate pricing summary" });
    }
};
