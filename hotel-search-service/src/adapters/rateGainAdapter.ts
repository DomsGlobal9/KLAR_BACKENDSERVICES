import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForRG } from "../services/destinationResolver";
import { rateGainProvider } from "../providers/rategain.provider";
import { getRGRawPrice, extractRGTaxes, round2, deriveRefundable } from "../utils/pricing.util";

export async function searchRG(
  req: UnifiedSearchRequest,
  clientType: "B2B" | "B2C" = "B2C",
): Promise<{ hotels: UnifiedHotel[]; total: number }> {
  // Ignore GEO: tokens — they're internal geo coordinate strings, NOT valid RateGain destination codes
  let rawDestCode = (req.destinationCode || "").toString().trim();
  let destCode = (rawDestCode && !rawDestCode.startsWith("GEO:")) ? rawDestCode : null;
  const isDirectRG = req.destination?.startsWith("RG:");

  const payload: any = {
    checkin: req.checkin,
    checkout: req.checkout,
    ...(req.countryCode ? { CountryCode: req.countryCode } : {}),
    ...(req.currency ? { Currency: req.currency } : {}),
    Rooms: req.rooms.map((r) => ({
      NumberOfRoom: 1,
      Adults: r.adults,
      Children: r.children,
      paxes: (r.childAges || []).map((age) => ({
        type: "Child",
        age: age || 5,
      })),
    })),
    echoToken: `echo-${Date.now()}`,
  };

  const geo = req._geoCenter;

  if (isDirectRG) {
    payload.propertyId = req.destination.replace("RG:", "");
  } else if (geo) {
    payload.Geofilter = {
      latitude: geo.lat.toFixed(6),
      longitude: geo.lng.toFixed(6),
      radius: geo.radiusKm ? Math.round(geo.radiusKm) : 25, // 25km default — tighter than 50km to avoid neighboring cities
    };
  } else if (req.destination) {
    if (!destCode) {
      destCode = await resolveForRG(req.destination);
      console.log(
        `[RateGain] Resolved destination "${req.destination}" to code: ${destCode}`,
      );
    }
    if (destCode) {
      payload.destinationCode = destCode;
    }
  }

  if (!payload.propertyId && !payload.Geofilter && !payload.destinationCode) {
    return { hotels: [], total: 0 };
  }

  try {
    console.log(
      `[RateGain] Preparing search with payload:`,
      JSON.stringify(payload, null, 2),
    );
    const pageNo = req.pageNo || 1;
    const batchSize = 1;
    const apiPageStart = (pageNo - 1) * batchSize + 1;

    console.log(
      `[RateGain] Requesting pages [${apiPageStart}] for search Page ${pageNo}`,
    );

    let allHotels: UnifiedHotel[] = [];
    let maxTotal = 0;

    try {
      // Step 1: Attempt search with payload as constructed (Geofilter first if geo available)
      let searchPayload = { ...payload, pageNo: apiPageStart };
      console.log(
        `[RateGain] Requesting Page ${apiPageStart} with ${payload.Geofilter ? "Geofilter" : "destCode: " + payload.destinationCode}`,
      );

      let res = await rateGainProvider.getBestProperties(searchPayload);
      let isSuccess =
        res.status === true ||
        res.status === "Success" ||
        res.header?.status === "Success" ||
        res.statusCode === 200;
      let total = parseInt(res.totalRecord || res.header?.totalRecord) || 0;

      // Step 2: Fallback to destinationCode if Geofilter was used and returned 0
      if (isSuccess && total === 0 && payload.Geofilter && req.destination) {
        console.log(
          `[RateGain] Zero results for Geofilter. Retrying with resolved destination code fallback...`,
        );
        if (!destCode) {
          destCode = await resolveForRG(req.destination);
        }
        if (destCode) {
          const { Geofilter, ...cleanPayload } = payload;
          searchPayload = {
            ...cleanPayload,
            destinationCode: destCode,
            pageNo: apiPageStart,
          };
          res = await rateGainProvider.getBestProperties(searchPayload);
          isSuccess =
            res.status === true ||
            res.status === "Success" ||
            res.header?.status === "Success" ||
            res.statusCode === 200;
          total = parseInt(res.totalRecord || res.header?.totalRecord) || 0;
        }
      }

      if (isSuccess) {
        const hotels = (res.body || []).map((h: any) =>
          mapRGHotel(h, clientType),
        );
        allHotels.push(...hotels);
        if (total > maxTotal) maxTotal = total;

        console.log(
          `[RateGain] Success: Found ${hotels.length} hotels (Total: ${total})`,
        );

        if (hotels.length === 0) {
          console.log(
            `[DEBUG] RateGain returned empty body. Raw response:`,
            JSON.stringify(res, null, 1).substring(0, 500),
          );
        }
      } else {
        console.warn(
          `[RateGain] Non-Success:`,
          JSON.stringify(
            {
              status: res.status,
              code: res.statusCode,
              header: res.header,
              desc: res.description,
            },
            null,
            2,
          ),
        );
      }
    } catch (err: any) {
      console.error(`[RateGain] API Error:`, err.message);
    }

    return {
      hotels: allHotels, // preserve RateGain's relevance/distance order
      total: Math.max(allHotels.length, maxTotal),
    };
  } catch (error: any) {
    console.error("[RateGain Adapter] Global Search Error:", error.message);
    throw error;
  }
}

function mapRGHotel(h: any, clientType: "B2B" | "B2C" = "B2C"): UnifiedHotel {
  // ── Image extraction ──────────────────────────────────────────────────────
  // RG places images in different locations depending on endpoint version.
  // Priority: hotel-level images first, then room-level.
  let imagesList: string[] = [];

  const extractUrls = (raw: any): string[] => {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
      .map((img: any) => {
        if (typeof img === "string") return img;
        // RG sometimes returns object with url/imageUrl/imageUrlPath/imageURL
        return (
          img.imageUrl ||
          img.imageUrlPath ||
          img.imageURL ||
          img.url ||
          img.src ||
          img.link ||
          img.href ||
          ""
        );
      })
      .filter(Boolean) as string[];
  };

  // 1. Hotel-level images (most reliable for RG bestproperties response)
  const hotelImgFields = [
    h.images,
    h.hotelImages,
    h.image,
    h.imageUrl,
    h.hotelImage,
    h.imageURL,
    h.imageUrlPath,
    h.hotelImgUrl,
  ];
  for (const f of hotelImgFields) {
    const urls = extractUrls(f);
    if (urls.length > 0) {
      imagesList = urls;
      break;
    }
  }

  // 2. Room-level images fallback (options/roomRates/rooms arrays)
  if (imagesList.length === 0) {
    const roomSources = [
      ...(Array.isArray(h.options) ? h.options : []),
      ...(Array.isArray(h.roomRates) ? h.roomRates : []),
      ...(Array.isArray(h.rooms) ? h.rooms : []),
    ];
    for (const room of roomSources) {
      const roomImgFields = [
        room.roomImages,
        room.images,
        room.image,
        room.imageUrl,
        room.imageUrlPath,
        room.roomImage,
        room.imageURL,
      ];
      for (const f of roomImgFields) {
        const urls = extractUrls(f);
        if (urls.length > 0) {
          imagesList = urls;
          break;
        }
      }
      if (imagesList.length > 0) break;
    }
  }

  // ── Price extraction ──────────────────────────────────────────────────────
  // We use the shared getRGRawPrice so search and details exactly match
  const rgRawPrice = getRGRawPrice(h);

  // RG bestproperties usually returns totalAmount as total stay.
  // If only per-night field found, mark it; otherwise treat as total.
  const isPerNight =
    !h.totalAmount &&
    !h.totalRate &&
    (h.displayRatePerNight || h.lowestRate || h.price) > 0;
  let totalPrice = Number(rgRawPrice) || 0;

  let isMandatory = false;
  let commissionAmt = 0;
  let commissionPct = 0;
  let sellingRate = 0;

  if (clientType === "B2C") {
    const b2cPrice =
      h.sellingRate ||
      h.roomRates?.[0]?.sellingRate ||
      h.options?.[0]?.sellingRate;
    if (b2cPrice) {
      totalPrice = Number(b2cPrice);
      sellingRate = Number(b2cPrice);
    }

    isMandatory =
      h.IsMandatory === true ||
      h.isMandatory === true ||
      h.roomRates?.[0]?.IsMandatory === true ||
      h.roomRates?.[0]?.isMandatory === true ||
      h.options?.[0]?.IsMandatory === true ||
      h.options?.[0]?.isMandatory === true;

    commissionAmt = Number(
      h.CommissionAmt ||
      h.commissionAmt ||
      h.roomRates?.[0]?.CommissionAmt ||
      h.roomRates?.[0]?.commissionAmt ||
      h.options?.[0]?.CommissionAmt ||
      h.options?.[0]?.commissionAmt ||
      0,
    );

    commissionPct = Number(
      h.CommissionPct ||
      h.commissionPct ||
      h.roomRates?.[0]?.CommissionPct ||
      h.roomRates?.[0]?.commissionPct ||
      h.options?.[0]?.CommissionPct ||
      h.options?.[0]?.commissionPct ||
      0,
    );
  }

  // Taxes: RG separates taxes in taxAmount/taxes/totalTax fields
  let includedTaxAmt = 0;
  let excludedTaxAmt = 0;
  const cur = h.currency || "INR";

  let taxDet = null;
  if (h.taxes) taxDet = extractRGTaxes(h.taxes, cur);
  if ((!taxDet || (taxDet.inc === 0 && taxDet.exc === 0)) && h.options?.[0]?.taxes) taxDet = extractRGTaxes(h.options[0].taxes, cur);
  if ((!taxDet || (taxDet.inc === 0 && taxDet.exc === 0)) && h.roomRates?.[0]?.taxes) taxDet = extractRGTaxes(h.roomRates[0].taxes, cur);

  if (taxDet) {
    includedTaxAmt = taxDet.inc;
    excludedTaxAmt = taxDet.exc;
  }
  
  if (includedTaxAmt === 0 && excludedTaxAmt === 0) {
    excludedTaxAmt =
      Number(
        h.taxAmount ||
        h.totalTax ||
        h.taxesAndFees ||
        h.roomRates?.[0]?.taxAmount,
      ) || 0;
  }

  const taxAmt = round2(includedTaxAmt + excludedTaxAmt);
  const taxesIncluded = taxAmt === 0;

  const finalTotalPrice = round2(totalPrice);
  const netBasePrice = round2(totalPrice - taxAmt);

  // Refundable status derived once, server-side (RG exposes no explicit flag)
  const refundable = deriveRefundable({
    cancellationPolicies:
      h.cancellationPolicies ||
      h.options?.[0]?.cancellationPolicies ||
      h.roomRates?.[0]?.cancellationPolicies,
    rateComments:
      h.rateComments || h.options?.[0]?.rateComments || h.roomRates?.[0]?.rateComments,
  });

  return {
    hotelId: `RG:${h.propertyId}`,
    source: "RG",
    isRefundable: refundable.isRefundable,
    refundableLabel: refundable.label,
    freeCancellationUntil: refundable.freeCancellationUntil,
    name: h.propertyName || h.hotelName || h.name || h.propertyNameClean || h.HotelName || "",
    address: h.address || h.hotelAddress || "",
    city: h.city || h.cityName || h.destinationName || h.CityName || "",
    country: h.countryName || h.country || "",
    starRating:
      parseFloat(h.categoryCode) ||
      parseFloat(h.starRating) ||
      parseFloat(h.rating) ||
      0,
    latitude: h.latitude || 0,
    longitude: h.longitude || 0,
    images: imagesList.filter(Boolean),
    price: finalTotalPrice,
    basePrice: netBasePrice, // net base (total minus included taxes)
    taxAmount: taxAmt,
    taxesIncluded,
    currency: h.currency || "INR",
    mealBasis:
      h.boardName ||
      h.boardType ||
      h.mealPlan ||
      h.mealBasis ||
      h.roomRates?.[0]?.boardName ||
      h.options?.[0]?.boardName ||
      undefined,
    hotelSegment: h.accTypeDesc || h.accMultiDesc || "Hotel",
    accTypeDesc: h.accTypeDesc,
    accMultiDesc: h.accMultiDesc,
    accomodationType: h.accomodationType,
    amenities: h.hotelAmenities ?? [],
    propertyCode: h.propertyCode,
    brandCode: h.brandCode,
    isMandatory,
    commissionAmt,
    commissionPct,
    sellingRate: sellingRate || undefined,
    paymentType: h.paymentType || "AT_WEB",
    packaging: h.packaging ?? false,
    boardCode: h.boardCode || "CO",
    boardName:
      h.boardName ||
      h.boardType ||
      h.mealPlan ||
      h.mealBasis ||
      h.roomRates?.[0]?.boardName ||
      h.options?.[0]?.boardName ||
      "",
    taxes: {
      taxes:
        taxAmt > 0
          ? [
            {
              included: false,
              amount: taxAmt.toFixed(2),
              currency: h.currency || "INR",
              clientAmount: taxAmt.toFixed(2),
              clientCurrency: h.currency || "INR",
            },
          ]
          : [],
      allIncluded: taxesIncluded,
    },
    pricing: {
      totalPrice: finalTotalPrice,
      taxes: taxAmt,
      mf: 0,
      mft: 0,
      currency: h.currency || "INR",
      basePrice: netBasePrice,
      markupAmount: 0,
      perNightPrice: isPerNight ? finalTotalPrice : null,
      supplierTotalPrice: finalTotalPrice,
      finalTotalPrice: finalTotalPrice,
      taxesIncluded: taxesIncluded,
    },
    rawPayload: h,
  };
}
