import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForRG } from "../services/destinationResolver";
import { rateGainProvider } from "../providers/rategain.provider";

export async function searchRG(req: UnifiedSearchRequest): Promise<{ hotels: UnifiedHotel[]; total: number }> {
  let destCode = (req.destinationCode || "").toString().trim() || null;
  if (!destCode && req.destination) {
    destCode = await resolveForRG(req.destination);
  }

  const geo = req._geoCenter;
  const payload: any = {
    checkin: req.checkin,
    checkout: req.checkout,
    CountryCode: req.countryCode ?? "IN",
    Currency: req.currency ?? "INR",
    Rooms: req.rooms.map(r => ({
      NumberOfRoom: 1,
      Adults: r.adults,
      Children: r.children,
      paxes: (r.childAges || []).map(age => ({ type: "Child", age: age || 5 }))
    })),
    Echotoken: `echo-${Date.now()}`
  };

  if (destCode) {
    payload.destinationCode = destCode;
  } else if (geo) {
    payload.Geofilter = {
      latitude: geo.lat.toFixed(6),
      longitude: geo.lng.toFixed(6),
      radius: "50"
    };
  } else {
    return { hotels: [], total: 0 };
  }

  try {
    const pageNo = req.pageNo || 1;
    const batchSize = 1; 
    const apiPageStart = ((pageNo - 1) * batchSize) + 1;
    const apiPages = Array.from({ length: batchSize }, (_, i) => apiPageStart + i);

    console.log(`[RateGain] Requesting pages [${apiPages.join(',')}] for search Page ${pageNo}`);

    let allHotels: UnifiedHotel[] = [];
    let maxTotal = 0;

    for (const page of apiPages) {
        try {
            const res = await rateGainProvider.getBestProperties({ ...payload, pageNo: page });
            
            // VERY LOOSE STATUS CHECK (as requested by spec 1.5.3)
            const isSuccess = res.status === true || res.status === "Success" || res.header?.status === "Success" || res.statusCode === 200;
            
            if (isSuccess) {
                const hotels = (res.body || []).map(mapRGHotel);
                allHotels.push(...hotels);
                const total = parseInt(res.totalRecord || res.header?.totalRecord) || 0;
                if (total > maxTotal) maxTotal = total;
                
                console.log(`[RateGain] Page ${page} Success: Found ${hotels.length} hotels (Total: ${total})`);
                
                if (hotels.length === 0) break;
            } else {
                console.warn(`[RateGain] Page ${page} Non-Success:`, JSON.stringify({ status: res.status, code: res.statusCode, desc: res.description }, null, 2));
            }
            
            await new Promise(r => setTimeout(r, 100));
        } catch (err: any) {
            console.error(`[RateGain] Page ${page} API Error:`, err.message);
        }
    }

    return {
      hotels: allHotels,
      total: Math.max(allHotels.length, maxTotal)
    };
  } catch (error: any) {
    console.error("[RateGain Adapter] Global Search Error:", error.message);
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
    currency: h.currency || "INR",
    amenities: h.hotelAmenities ?? [],
    propertyCode: h.propertyCode,
    brandCode: h.brandCode,
    rawPayload: h
  };
}
