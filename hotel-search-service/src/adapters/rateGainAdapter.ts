import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { resolveForRG } from "../services/destinationResolver";
import { rateGainProvider } from "../providers/rategain.provider";

export async function searchRG(req: UnifiedSearchRequest): Promise<UnifiedHotel[]> {
  const destCode = await resolveForRG(req.destination);
  if (!destCode) return [];

  const payload = {
    destinationCode: destCode,
    checkin: req.checkin,
    checkout: req.checkout,
    CountryCode: req.countryCode ?? "US",
    Currency: req.currency ?? "USD",
    Rooms: req.rooms.map(r => ({
      NumberOfRoom: 1,
      Adults: r.adults,
      Children: r.children,
      paxes: (r.childAges || []).map(age => ({ type: "Child", age }))
    })),
    Echotoken: `echo-${Date.now()}`,
    pageNo: 1
  };

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
