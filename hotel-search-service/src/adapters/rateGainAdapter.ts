import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForRG } from "../services/destinationResolver";
import { rateGainProvider } from "../providers/rategain.provider";

export async function searchRG(req: UnifiedSearchRequest): Promise<UnifiedHotel[]> {
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
    CountryCode: req.countryCode ?? "IN",
    Currency: req.currency ?? "INR",
    Rooms: req.rooms.map(r => ({
      NumberOfRoom: 1,
      Adults: r.adults,
      Children: r.children,
      paxes: (r.childAges || []).map(age => ({ type: "Child", age }))
    })),
    Echotoken: `echo-${Date.now()}`,
    pageNo: 1
  };

  // 3. Handle coordinates (Geofilter) if no destination code found
  if (!destCode && req.destination) {
    const coordRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
    const match = req.destination.match(coordRegex);
    if (match) {
      payload.Geofilter = {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[3]),
        radius: 30 // Default 30km for RateGain
      };
      delete payload.destinationCode;
    }
  }

  // 4. Strict Validation: At least one filter must be present to avoid 400
  if (!payload.destinationCode && !payload.Geofilter) {
    console.warn("[RateGain Adapter] Skipping search: No valid destinationCode or Geofilter resolved for", req.destination);
    return [];
  }

  try {
    const res = await rateGainProvider.getBestProperties(payload);
    return (res.body ?? []).map(mapRGHotel);
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
