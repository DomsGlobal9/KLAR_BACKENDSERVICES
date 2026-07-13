import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForRG } from "../services/destinationResolver";
import { rateGainProvider } from "../providers/rategain.provider";

export async function searchRG(
  req: UnifiedSearchRequest,
  clientType: "B2B" | "B2C" = "B2C",
): Promise<{ hotels: UnifiedHotel[]; total: number; hasMore: boolean }> {
  let destCode = (req.destinationCode || "").toString().trim() || null;
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
    return { hotels: [], total: 0, hasMore: false };
  }

  try {
    console.log(
      `[RateGain] Preparing search with payload:`,
      JSON.stringify(payload, null, 2),
    );
    const pageNo = req.pageNo || 1;
    const batchSize = 1;
    const apiPageStart = (pageNo - 1) * batchSize + 1;
    // RateGain returns a fixed 20 properties per page. If that ever changes,
    // hasMore is off by at most one page — the client also stops as soon as a
    // page adds no new hotels.
    const RG_PAGE_SIZE = 20;

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

      let res = await rateGainProvider.getBestProperties(searchPayload, req._abortSignal);
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
          res = await rateGainProvider.getBestProperties(searchPayload, req._abortSignal);
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

    // Unlike TripJack's, RateGain's totalRecord is a real count of matching
    // properties, so the page position tells us whether more remain.
    const consumed = apiPageStart * RG_PAGE_SIZE;
    return {
      hotels: allHotels, // preserve RateGain's relevance/distance order
      total: Math.max(allHotels.length, maxTotal),
      hasMore: allHotels.length > 0 && consumed < maxTotal,
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
  // RG bestproperties response uses various price field names.
  // We always normalize to TOTAL STAY price for uniform display.
  // RG typically returns per-night rates; we expose both.
  const rgRawPrice =
    h.totalAmount || // Total stay (preferred)
    h.totalRate ||
    h.displayRatePerNight || // Per-night (need to check)
    h.lowestRate ||
    h.price ||
    h.rate ||
    h.roomRates?.[0]?.totalAmount ||
    h.options?.[0]?.price ||
    0;

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
  // Sometimes it's a nested object: { taxes: [{ amount: '75', clientAmount: '1830' }] }
  let extractedTaxAmt = 0;

  const extractTaxFromObj = (taxObj: any) => {
    if (!taxObj) return 0;
    if (typeof taxObj === "number") return taxObj;
    if (typeof taxObj === "string") return Number(taxObj) || 0;
    if (Array.isArray(taxObj.taxes)) {
      return taxObj.taxes.reduce(
        (sum: number, t: any) =>
          sum + (Number(t.clientAmount || t.amount) || 0),
        0,
      );
    }
    return 0;
  };

  extractedTaxAmt =
    extractTaxFromObj(h.taxes) ||
    extractTaxFromObj(h.options?.[0]?.taxes) ||
    extractTaxFromObj(h.roomRates?.[0]?.taxes) ||
    Number(
      h.taxAmount ||
        h.totalTax ||
        h.taxesAndFees ||
        h.roomRates?.[0]?.taxAmount,
    ) ||
    0;

  const taxAmt = extractedTaxAmt;
  // If taxAmount exists and is > 0, taxes are excluded from base price (need to be added)
  const taxesIncluded = taxAmt === 0; // RG usually excludes taxes; taxesIncluded=false unless no tax field

  return {
    hotelId: `RG:${h.propertyId}`,
    source: "RG",
    name: h.propertyName,
    address: h.address || "",
    city: h.city || h.destinationName || "",
    country: h.countryName || h.country || "",
    starRating:
      parseFloat(h.categoryCode) ||
      parseFloat(h.starRating) ||
      parseFloat(h.rating) ||
      0,
    latitude: h.latitude || 0,
    longitude: h.longitude || 0,
    images: imagesList.filter(Boolean),
    price: totalPrice,
    basePrice: totalPrice - taxAmt, // net base (total minus taxes)
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
      "LUNCH INCLUDED",
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
      totalPrice: totalPrice,
      taxes: taxAmt,
      mf: 0,
      mft: 0,
      currency: h.currency || "INR",
      basePrice: totalPrice - taxAmt,
      markupAmount: 0,
      perNightPrice: isPerNight ? totalPrice : null,
      supplierTotalPrice: totalPrice,
      finalTotalPrice: totalPrice,
      taxesIncluded: taxesIncluded,
    },
    rawPayload: h,
  };
}
