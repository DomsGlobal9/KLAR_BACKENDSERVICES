import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { deriveRefundable, platformMarkupAmount, round2 } from "../utils/pricing.util";
import { resolveForTJ } from "../services/destinationResolver";
import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";
import { HotelModel } from "../models/Hotel.model";
import { toTjNationality } from "../utils/nationality";
import { qualifyImageUrls } from "../utils/imageUrl.util";

// ─── TripJack Circuit Breaker ────────────────────────────────────────────────
let tjCircuitOpenUntil = 0;
function isTJCircuitOpen(): boolean {
  return Date.now() < tjCircuitOpenUntil;
}
function tripTJCircuit() {
  tjCircuitOpenUntil = Date.now() + 60_000;
  console.error(`[TripJack] ⚡ Circuit breaker OPEN.`);
}

export async function searchTJ(
  req: UnifiedSearchRequest,
): Promise<{ hotels: UnifiedHotel[]; total: number; hasMore: boolean }> {
  if (isTJCircuitOpen()) return { hotels: [], total: 0, hasMore: false };

  const hids = await resolveForTJ(req.destination, req._geoCenter);
  if (!hids.length) return { hotels: [], total: 0, hasMore: false };
  const correlationId = uuidv4();
  const page = req.pageNo || 1;

  const targetCount = 20;
  const CHUNK_SIZE = 100; // Increased to 100 to find hotels faster per page
  const chunks: string[][] = [];
  for (let i = 0; i < hids.length; i += CHUNK_SIZE) {
    chunks.push(hids.slice(i, i + CHUNK_SIZE));
  }
  const batchSize = 1; // Sequential to prevent TripJack 403 Rate Limit / WAF rules
  const currentIdx = (page - 1) * batchSize;

  try {
    let collectedHotels: any[] = [];
    const startId = currentIdx * CHUNK_SIZE;
    const endId = Math.min(startId + batchSize * CHUNK_SIZE, hids.length);
    console.log(
      `[TripJack] Pagination: Page ${page} processing HIDs index ${startId} to ${endId}`,
    );

    // Run nationality lookup in parallel with the chunk fetching setup
    const nationalityId = await toTjNationality(req.countryCode ?? "IN");
    const fetchStartTime = Date.now();

    // Fetch chunks concurrently to ensure extreme high-speed response
    const fetchPromises = [];
    for (let i = 0; i < batchSize; i++) {
      const chunkIdx = currentIdx + i;
      if (chunkIdx >= chunks.length) break;

      const chunk = chunks[chunkIdx];
      const payload = {
        checkIn: req.checkin,
        checkOut: req.checkout,
        rooms: req.rooms.map((r) => ({
          adults: Number(r.adults),
          children: Number(r.children || 0),
          childAge: r.childAges?.length ? r.childAges : undefined,
        })),
        currency: req.currency ?? "INR",
        nationality: nationalityId,
        hids: chunk.map((id) => parseInt(id)),
        correlationId,
      };

      fetchPromises.push(
        tripJackClient
          .post("/hms/v3/hotel/listing", payload, {
            timeout: 15000,
            signal: req._abortSignal ?? undefined,
          })
          .then((res) => res.data?.hotels || [])
          .catch((err) => {
            // Deliberate cancellation once the partial-return window elapsed —
            // not a supplier fault, so don't log noise or trip the breaker.
            if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
              return [];
            }
            const status = err.response?.status;
            console.error(
              `[TripJack] Chunk Fetch Error (status ${status}):`,
              err.message,
            );
            // Trip circuit breaker on repeated server errors (5xx)
            if (status >= 500) tripTJCircuit();
            return [];
          }),
      );
    }

    const resolvedArrays = await Promise.all(fetchPromises);
    for (const found of resolvedArrays) {
      collectedHotels.push(...found);
    }

    collectedHotels = collectedHotels.slice(0, targetCount);
    console.log(
      `[TripJack] Parallel Fetch Complete in ${Date.now() - fetchStartTime}ms. Found ${collectedHotels.length} hotels.`,
    );

    const finalHotels = collectedHotels.slice(0, targetCount);
    console.log(
      `[TripJack] Fast Return: Returning ${finalHotels.length} hotels.`,
    );

    let mapped: UnifiedHotel[] = finalHotels.map((h: any) =>
      mapTJHotel(h, correlationId),
    );

    // Geographic Sanity Check: filter out hotels whose country doesn't match
    // the resolved geo center's country (catches cross-border results).
    if (req._geoCenter) {
      const targetCountry = (req.countryCode || "IN").toUpperCase();
      // Only apply country filter for well-known single-country searches
      const COUNTRY_NAMES: Record<string, string[]> = {
        IN: ["india", "indian"],
        AE: ["united arab emirates", "uae", "dubai", "emirates"],
        GB: ["united kingdom", "uk", "england", "britain"],
        US: ["united states", "usa", "america"],
        SG: ["singapore"],
        MY: ["malaysia"],
        TH: ["thailand"],
        FR: ["france", "french"],
        DE: ["germany", "german", "deutschland"],
      };
      const allowedTerms = COUNTRY_NAMES[targetCountry];
      if (allowedTerms) {
        const initialCount = mapped.length;
        mapped = mapped.filter((h) => {
          const country = (h.country || "").toLowerCase();
          const addr = (h.address || "").toLowerCase();
          // Keep if country field is empty (will be enriched later)
          if (!country) return true;
          // Keep if country matches target
          if (allowedTerms.some((t) => country.includes(t))) return true;
          // Reject if clearly a different country
          return false;
        });
        if (mapped.length < initialCount) {
          console.log(
            `[TripJack] Filtered out ${initialCount - mapped.length} cross-country hotels for target country: ${targetCountry}`,
          );
        }
      }
    }

    // ASYNC ENRICHMENT (don't wait for DB if it's too slow, but here we do it fast)
    try {
      const tjIds = mapped.map((h) => h.hotelId.replace("TJ:", ""));
      const staticData = await HotelModel.find({ tjHotelId: { $in: tjIds } })
        .limit(100)
        .lean();
      const staticMap = new Map(staticData.map((s) => [s.tjHotelId, s]));

      mapped = mapped.map((bh) => {
        const s = staticMap.get(bh.hotelId.replace("TJ:", ""));
        if (s) {
          const accTypeDesc = bh.accTypeDesc || s.accTypeDesc || "";
          const accMultiDesc = bh.accMultiDesc || s.accMultiDesc || "";
          const accomodationType =
            bh.accomodationType || s.accomodationType || "";
          const rating = bh.starRating || s.starRating || 0;
          // Always prefer DB images since TJ listing API rarely returns images
          const enrichedImages = (() => {
            // Use listing images if present; otherwise always fall back to DB.
            // bh.images is already qualified by mapTJHotel; the DB copy is not,
            // so it goes through the same resolver before it can be counted.
            if (bh.images && bh.images.length > 0) return bh.images;
            const dbImages = qualifyImageUrls(s.images, "TJ");
            if (dbImages.length > 0) return dbImages;
            return [];
          })();
          const finalAmenities =
            bh.amenities && bh.amenities.length > 0
              ? bh.amenities
              : getTJFallbackAmenities(bh.name || s.name, rating);

          return {
            ...bh,
            address: bh.address || s.address || "",
            city: bh.city || s.cityName || "",
            starRating: rating,
            images: enrichedImages,
            latitude: bh.latitude || s.location?.coordinates?.[1],
            longitude: bh.longitude || s.location?.coordinates?.[0],
            accTypeDesc,
            accMultiDesc,
            accomodationType,
            hotelSegment:
              accTypeDesc || accMultiDesc || bh.hotelSegment || "Hotel",
            amenities: finalAmenities,
          };
        }
        return bh;
      });
    } catch (enrichErr) {
      console.warn("[TripJack] DB enrichment warning:", enrichErr);
    }

    return {
      hotels: mapped,
      // Candidate ids in radius — an upper bound, not a hotel count. Goa resolves
      // ~6,179 ids and yields ~20 bookable hotels.
      total: hids.length,
      // More pages exist only while unprocessed id chunks remain.
      hasMore: endId < hids.length,
    };
  } catch (error: any) {
    console.error("[TripJack Adapter] Search Error:", error.message);
    // Trip circuit breaker if it's a 5xx from TJ
    if (error.response?.status >= 500) tripTJCircuit();
    throw error;
  }
}

function getTJFallbackAmenities(name: string, starRating: number): string[] {
  const amenities = ["Free Wi-Fi", "Air Conditioning", "Room Service"];
  if (starRating >= 5) {
    amenities.push(
      "Swimming Pool",
      "Fitness Center",
      "Spa",
      "Restaurant",
      "Bar",
    );
  } else if (starRating >= 4) {
    amenities.push("Swimming Pool", "Fitness Center", "Restaurant");
  } else if (starRating >= 3) {
    amenities.push("Restaurant", "24-hour Front Desk");
  } else {
    amenities.push("24-hour Front Desk");
  }

  const lowerName = (name || "").toLowerCase();
  if (
    lowerName.includes("resort") ||
    lowerName.includes("spa") ||
    lowerName.includes("beach")
  ) {
    if (!amenities.includes("Swimming Pool")) amenities.push("Swimming Pool");
    if (!amenities.includes("Spa")) amenities.push("Spa");
  }
  if (lowerName.includes("parking") || lowerName.includes("airport")) {
    amenities.push("Free Parking");
  }
  return [...new Set(amenities)];
}

function mapTJHotel(h: any, correlationId: string): UnifiedHotel {
  const opt = h.options?.[0];
  const hotelId = h.tjHotelId || h.hotelId || h.id;
  const rating = parseInt(h.rating) || 0;
  const refundable = deriveRefundable({
    explicit: opt?.cancellation?.isRefundable,
    cancellationPolicies: opt?.cancellation?.penalties,
  });
  // Platform (super-admin) markup baked into the net the agent sees ("api price").
  const tjBase = Number(opt?.pricing?.basePrice ?? opt?.pricing?.totalPrice ?? 0);
  const tjTotal = Number(opt?.pricing?.totalPrice ?? 0);
  const tjPlatformAmt = platformMarkupAmount(tjBase);
  const finalAmenities =
    h.amenities && h.amenities.length > 0
      ? h.amenities
      : getTJFallbackAmenities(h.name, rating);

  return {
    hotelId: `TJ:${hotelId}`,
    source: "TJ",
    name: h.name,
    address: h.address,
    city: h.city,
    country: h.country,
    starRating: rating,
    latitude: h.latitude,
    longitude: h.longitude,
    // TJ listing rarely returns images — DB enrichment fills these in the
    // enrichment step below. Qualified here so anything unresolvable is dropped
    // at the source instead of reaching the gallery as a dead URL.
    images: qualifyImageUrls(
      Array.isArray(h.images) && h.images.length > 0 ? h.images : h.img,
      "TJ",
    ),
    // TJ: totalPrice already includes all taxes + management fees. taxesIncluded = true.
    // basePrice = the base net price (without taxes); taxAmount = taxes on top (0 at search level — detail has breakdown).
    price: round2(tjTotal + tjPlatformAmt),
    basePrice: round2(tjBase + tjPlatformAmt),
    taxAmount: opt?.pricing?.taxes ?? 0,
    taxesIncluded: false, // TJ: taxes are NOT baked into basePrice; totalPrice = basePrice + taxes + mf + mft
    currency: opt?.pricing?.currency ?? "INR",
    mealBasis: opt?.mealBasis,
    hotelSegment: h.accTypeDesc || h.accMultiDesc || "Hotel",
    accTypeDesc: h.accTypeDesc,
    accMultiDesc: h.accMultiDesc,
    accomodationType: h.accomodationType,
    isRefundable: refundable.isRefundable,
    refundableLabel: refundable.label,
    freeCancellationUntil: refundable.freeCancellationUntil,
    onHoldAllowed:
      opt?.onHoldAllowed ??
      opt?.cancellation?.onHoldAllowed ??
      opt?.cancellation?.isRefundable ??
      false,
    holdConfirm:
      opt?.holdConfirm ??
      opt?.cancellation?.holdConfirm ??
      opt?.cancellation?.isRefundable ??
      false,
    amenities: finalAmenities,
    propertyCode: hotelId.toString(),
    brandCode: "",
    rawPayload: { ...h, _correlationId: correlationId },
  };
}
