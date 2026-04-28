import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForRG, resolveCityToCoords } from "../services/destinationResolver";
import { rateGainProvider } from "../providers/rategain.provider";

export async function searchRG(req: UnifiedSearchRequest): Promise<{ hotels: UnifiedHotel[]; total: number }> {
  // 1. Determine destination code (prefer explicit, then resolve from name)
  let destCode = (req.destinationCode || "").toString().trim() || null;
  if (!destCode && req.destination) {
    destCode = await resolveForRG(req.destination);
  }

  // 2. Setup payload
  const payload: any = {
    destinationCode: destCode,
    checkin: req.checkin,
    checkout: req.checkout,
    CountryCode: req.countryCode ?? "US",
    Currency: req.currency ?? "USD",
    Rooms: req.rooms.map(r => ({
      NumberOfRoom: 1,
      Adults: r.adults,
      Children: r.children,
      paxes: (r.childAges || []).map(age => ({ type: "Child", age: age || 5 }))
    })),
    Echotoken: `echo-${Date.now()}`,
    pageNo: req.pageNo || 1
  };

  // 3. Handle coordinates (Geofilter) for precise location
  if (req.destination) {
    const geo = await resolveCityToCoords(req.destination);
    if (geo) {
      payload.Geofilter = {
        latitude: geo.lat.toString(),
        longitude: geo.lng.toString(),
        radius: "30" // 30km radius for RateGain
      };
    }
  }

  // 4. Strict Validation: At least one filter must be present to avoid 400
  if (!payload.destinationCode && !payload.Geofilter) {
    console.warn("[RateGain Adapter] Skipping search: No valid destinationCode or Geofilter resolved for", req.destination);
    return { hotels: [], total: 0 };
  }

  console.log(`[RateGain Adapter] Request Payload for ${req.destination}:`, JSON.stringify(payload, null, 2));

  try {
    const pageNo = req.pageNo || 1;

    // Page 1: 30 items for fast first render (~2 API pages of 15-20 each)
    // Scroll pages: 20 items (~2 API pages)
    const targetCount = pageNo === 1 ? 30 : 20;

    // OFFSET FORMULA (avg ~15 hotels per RG API page):
    //   Page 1 → API pages 1,2    (2 pages → ~30 hotels → keep 30)
    //   Page N → API pages (3 + 2*(N-2))
    const batchSize = 2;
    const apiPageStart = pageNo === 1 ? 1 : (3 + (pageNo - 2) * 2);

    const apiPages = Array.from({ length: batchSize }, (_, i) => apiPageStart + i);

    console.log(`[RateGain] Page ${pageNo}: fetching API pages [${apiPages.join(',')}] for ~${targetCount} hotels`);

    const batchPromises = apiPages.map(page =>
      rateGainProvider.getBestProperties({ ...payload, pageNo: page })
        .then(res => ({
          hotels: (res.body || []).map(mapRGHotel),
          total: parseInt(res.totalRecord) || 0
        }))
        .catch(err => {
          console.error(`[RateGain] API page ${page} failed: ${err.message}`);
          return { hotels: [], total: 0 };
        })
    );

    const batchResults = await Promise.all(batchPromises);

    let allHotels: UnifiedHotel[] = [];
    let maxTotal = 0;

    batchResults.forEach(r => {
      allHotels.push(...r.hotels);
      if (r.total > maxTotal) maxTotal = r.total;
    });

    // Cap to target
    if (allHotels.length > targetCount) {
      allHotels = allHotels.slice(0, targetCount);
    }

    // If we got fewer than target, we've probably exhausted inventory
    const finalTotal = allHotels.length < targetCount ? allHotels.length : maxTotal;

    console.log(`[RateGain] Done. Found: ${allHotels.length} hotels (total avail: ${maxTotal})`);

    return {
      hotels: allHotels,
      total: finalTotal || maxTotal
    };
  } catch (error: any) {
    console.error("[RateGain Adapter] Search Error:", error.response?.data || error.message);
    throw error;
  }
}

function mapRGHotel(h: any): UnifiedHotel {
  return {
    hotelId: `RG:${h.propertyId}`,
    source: "RG",
    name: h.propertyName,
    address: h.address || "",
    city: h.city || "",
    country: h.countryName || "",
    starRating: parseFloat(h.categoryCode) || 0,
    latitude: h.latitude || 0,
    longitude: h.longitude || 0,
    images: (h.images ?? []).filter(Boolean),
    price: h.price || 0,
    currency: h.currency || "USD",
    amenities: h.hotelAmenities ?? [],
    propertyCode: h.propertyCode,
    brandCode: h.brandCode,
    rawPayload: h
  };
}
