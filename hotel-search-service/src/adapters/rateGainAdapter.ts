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
    const firstPageRes = await rateGainProvider.getBestProperties(payload);
    let hotels = firstPageRes.body ?? [];
    const total = parseInt(firstPageRes.totalRecord) || hotels.length;

    // If there are more results, fetch all other pages in parallel
    if (total > hotels.length && !req.pageNo) {
      const pageSize = hotels.length || 20;
      const totalPages = Math.ceil(total / pageSize);
      const remainingPages = [];
      
      for (let p = 2; p <= totalPages; p++) {
        remainingPages.push(p);
      }

      console.log(`[RateGain Adapter] Total results: ${total}. Fetching remaining ${remainingPages.length} pages...`);

      const pagePromises = remainingPages.map(page => 
        rateGainProvider.getBestProperties({ ...payload, pageNo: page })
      );

      const pageResults = await Promise.all(pagePromises);
      pageResults.forEach(res => {
        if (res.body && Array.isArray(res.body)) {
          hotels = [...hotels, ...res.body];
        }
      });
    }
    
    console.log(`
┌─────────── RATEGAIN SEARCH STATS ───────────┐
│ 📍 Location: ${req.destination}
│ 🔢 Dest Code: ${destCode || 'Geofilter Coords'}
│ 💰 Currency: ${payload.Currency} / ${payload.CountryCode}
│ 📊 Total Results: ${total}
│ ✅ API returned: ${hotels.length} hotels (All pages merged)
└─────────────────────────────────────────────┘
    `);
    
    return {
        hotels: hotels.map(mapRGHotel),
        total
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
