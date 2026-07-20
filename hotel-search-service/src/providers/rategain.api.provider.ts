import { rateGainClient } from "../clients/rategain.client";
import {
  buildPublicPricing,
  calculateEnrichedPricing,
  calculateNightsFromDates,
} from "../utils/pricing.util";
import { resolveMarkupRules } from "../utils/auth";
import { HotelModel } from "../models/Hotel.model";

/** Full supplier request/response bodies. Multi-megabyte and pretty-printed — opt-in only. */
const DEBUG_PAYLOADS = process.env.HOTEL_DEBUG_PAYLOADS === "true";

export class RateGainApiProvider {
  async getDestinations() {
    try {
      const res = await rateGainClient.get(
        "/api/SmartDistribution/getDestinations",
      );
      return res.data;
    } catch (error: any) {
      console.error(
        "[RateGain] GetDestinations Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }

  async getBestProperties(payload: any, signal?: AbortSignal | null) {
    const rateGainPayload: any = {
      destinationCode: payload.destinationCode || payload.destCode,
      checkin: payload.checkin || payload.checkIn,
      checkout: payload.checkout || payload.checkOut,
      Echotoken:
        payload.Echotoken ||
        payload.echotoken ||
        payload.echoToken ||
        `echo-${Date.now()}`,
      Rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
        const adultsCount = r.adults || r.Adults || 2;
        const childrenCount = r.children || r.Children || 0;
        let paxes = r.paxes || [];
        if (childrenCount > 0 && paxes.length === 0) {
          const childrenAges: number[] = r.childrenAges || [];
          if (childrenAges.length > 0) {
            paxes = childrenAges.map((age: number) => ({
              type: "Child",
              age: age || 5,
            }));
          } else {
            paxes = Array(childrenCount)
              .fill(0)
              .map(() => ({ type: "Child", age: 5 }));
          }
        }
        return {
          NumberOfRoom: r.NumberOfRoom || r.numberOfRoom || 1,
          Adults: adultsCount,
          Children: childrenCount,
          paxes,
        };
      }),
      pageNo: payload.pageNo || 1,
    };

    const propertyId =
      payload.PropertyId || payload.propertyId || payload.propertyID;
    if (propertyId) rateGainPayload.PropertyId = propertyId;
    if (payload.CountryCode || payload.countryCode)
      rateGainPayload.CountryCode = payload.CountryCode || payload.countryCode;
    if (payload.Currency || payload.currency)
      rateGainPayload.Currency = payload.Currency || payload.currency;
    if (payload.starRating) rateGainPayload.starRating = payload.starRating;
    if (payload.Geofilter) rateGainPayload.Geofilter = payload.Geofilter;

    try {
      console.log(
        `[RateGain] Requesting Best Properties: ${JSON.stringify(rateGainPayload, null, 2)}`,
      );
      const res = await rateGainClient.post(
        "/api/SmartDistribution/bestproperties",
        rateGainPayload,
        { signal: signal ?? undefined },
      );
      return res.data;
    } catch (error: any) {
      // Deliberate cancellation once the partial-return window elapsed — surface
      // it quietly so the orchestrator's catch drops it without logging noise.
      if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
        throw error;
      }
      console.error(
        "[RateGain] BestProperties Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }

  /**
   * POST /api/SmartDistribution/getproducts
   * Get room-level product details for a specific property.
   * Enriches each rate with backend-computed markup and per-night pricing.
   */
  async getAllProducts(payload: any) {
    const propertyId = (
      payload.PropertyId ||
      payload.propertyID ||
      payload.propertyId ||
      payload.hid ||
      ""
    )
      .toString()
      .replace("RG:", "");

    // ── Fetch markup rules & night count — run in parallel with RateGain call ──
    const token = payload.token || null;
    const nights = calculateNightsFromDates(
      payload.checkin || payload.checkIn,
      payload.checkout || payload.checkOut,
    );

    // Start markup fetch in parallel — doesn't block the RateGain API call
    const markupRulesPromise = resolveMarkupRules(
      payload.clientType === "B2B" ? "B2B" : "B2C",
      token,
    );

    // Same for the static-data lookup: it enriches the response but nothing in
    // the RateGain call depends on it, so it must not sit behind it.
    const staticHotelPromise = HotelModel.findOne({ tjHotelId: propertyId })
      .lean()
      .catch((err) => {
        console.warn("[RateGain] Failed to fetch static data from DB:", err);
        return null;
      });

    const rateGainPayload: any = {
      propertyID: propertyId,
      PropertyCode: payload.PropertyCode || payload.propertyCode,
      BrandCode: payload.BrandCode || payload.brandCode || "N/A",
      checkin: payload.checkin || payload.checkIn,
      checkout: payload.checkout || payload.checkOut,
      CountryCode: payload.CountryCode || payload.countryCode,
      Currency: payload.Currency || payload.currency,
      Rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
        const adultsCount = r.adults || r.Adults || 2;
        const childrenCount = r.children || r.Children || 0;
        let paxes = r.paxes || [];
        if (childrenCount > 0 && paxes.length === 0) {
          const childrenAges: number[] = r.childrenAges || r.childAges || [];
          if (childrenAges.length > 0) {
            paxes = childrenAges.map((age: number) => ({
              type: "Child",
              age: age || 5,
            }));
          } else {
            paxes = Array(childrenCount)
              .fill(0)
              .map(() => ({ type: "Child", age: 5 }));
          }
        }
        return {
          numberOfRoom: r.numberOfRoom || r.NumberOfRoom || 1,
          adults: adultsCount,
          children: childrenCount,
          paxes,
        };
      }),
      echoToken:
        payload.echoToken ||
        payload.echotoken ||
        payload.Echotoken ||
        `echo-${Date.now()}`,
    };

    if (payload.destinationCode || payload.destCode) {
      rateGainPayload.destinationCode =
        payload.destinationCode || payload.destCode;
    }

    try {
      console.log(`[RateGain] Requesting products for property ${propertyId}`);
      if (DEBUG_PAYLOADS) {
        console.log(
          `[RateGain] Products payload: ${JSON.stringify(rateGainPayload, null, 2)}`,
        );
      }
      const res = await rateGainClient.post(
        "/api/SmartDistribution/getproducts",
        rateGainPayload,
      );
      const rawData = res.data;
      const markupRules = await markupRulesPromise;

      // ── Enrich each rate with backend-computed pricing (safe — never throws) ──
      const enrichRate = (rate: any) => {
        try {
          const parseAmt = (val: any) => {
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            if (!val) return 0;
            const parsed = Number(val.toString().replace(/,/g, ''));
            return isNaN(parsed) ? 0 : parsed;
          };

          // RateGain getproducts returns RoomRate as the primary price field
          const totalPrice = parseAmt(
            rate.RoomRate ||
            rate.totalAmount ||
            rate.sellingRate ||
            rate.totalRate ||
            rate.price ||
            rate.net ||
            rate.rate ||
            rate.totalPrice ||
            rate.netPrice ||
            0,
          );
          const taxAmount = Number(
            rate.taxAmount || rate.taxes || rate.totalTax || rate.tax || 0,
          );
          const basePrice = totalPrice - taxAmount;
          const currency =
            rate.currency || payload.Currency || payload.currency || "INR";

          const enriched = calculateEnrichedPricing(
            {
              basePrice,
              totalPrice,
              taxes: taxAmount,
              mf: 0,
              mft: 0,
              currency,
            },
            markupRules,
            nights,
          );

          return {
            ...rate,
            price: enriched.finalTotalPrice,
            netPrice: enriched.basePrice,
            pricing: buildPublicPricing({
              enriched,
              taxes: taxAmount,
              mf: 0,
              mft: 0,
              currency,
              clientType: payload.clientType === "B2B" ? "B2B" : "B2C",
            }),
          };
        } catch {
          return rate; // fallback: return rate unchanged if enrichment fails
        }
      };

      // Walk the RateGain response — guard against null/unexpected shapes
      try {
        // Recursive deep search to find and enrich products/rates
        const enrichDeep = (obj: any): any => {
          if (!obj || typeof obj !== "object") return obj;

          // If this object itself has 'rate' or 'rates', treat it as a product and enrich it
          if (
            Array.isArray(obj.rate) ||
            Array.isArray(obj.rates) ||
            (obj.RoomSelectionKey && (obj.price || obj.net))
          ) {
            const rates = Array.isArray(obj.rate)
              ? obj.rate
              : Array.isArray(obj.rates)
                ? obj.rates
                : null;
            if (rates) {
              const enrichedRates = rates.map(enrichRate);
              return { ...obj, rate: enrichedRates, rates: enrichedRates };
            }
            // If it's a rate itself
            return enrichRate(obj);
          }

          // Otherwise, traverse its properties
          if (Array.isArray(obj)) {
            return obj.map((item) => enrichDeep(item));
          }

          const newObj: any = {};
          for (const key in obj) {
            newObj[key] = enrichDeep(obj[key]);
          }
          return newObj;
        };

        let finalData = enrichDeep(rawData);

        const staticHotel = await staticHotelPromise;
        if (staticHotel) {
          finalData = {
            ...finalData,
            images: staticHotel.images || [],
            name: staticHotel.name,
            address: staticHotel.address,
            city: staticHotel.cityName,
            starRating: staticHotel.starRating,
            latitude: staticHotel.location?.coordinates?.[1],
            longitude: staticHotel.location?.coordinates?.[0],
            description: staticHotel.accMultiDesc || staticHotel.accTypeDesc || "",
          };
        }

        return {
          status: true,
          statusCode: 200,
          description: "Success",
          body: finalData
        };
      } catch (enrichErr: any) {
        console.warn(
          "[RateGain] Pricing enrichment warning (non-fatal):",
          enrichErr?.message,
        );
      }

      return rawData;
    } catch (error: any) {
      console.error(
        "[RateGain] GetProducts Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }

  async getSpecialRequests() {
    try {
      const res = await rateGainClient.get(
        "/api/SmartDistribution/getSpecialRequests",
      );
      return res.data;
    } catch (error: any) {
      console.error(
        "[RateGain] GetSpecialRequests Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }
}
