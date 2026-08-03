import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";
import { deriveRefundable, platformMarkupAmount, round2 } from "../utils/pricing.util";
import { resolveForTJ } from "../services/destinationResolver";
import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";
import { HotelModel } from "../models/Hotel.model";
import { toTjNationality } from "../utils/nationality";
import { qualifyImageUrls } from "../utils/imageUrl.util";
import { deriveRegion } from "../utils/region.util";

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

  // Densification: a listing call only returns the hotels among the supplied ids
  // that are actually bookable on these dates — for a big destination that's a
  // small fraction (Goa yields ~1 hotel per 20 ids). Scanning 20 ids per page
  // therefore contributed ~1 hotel per page and made every scroll a fresh
  // supplier round-trip. Instead each page scans a WINDOW of ids
  // (TJ_HIDS_PER_PAGE) split into listing-sized chunks, run a few at a time.
  //
  // Concurrency is bounded and kept low because TripJack's WAF answers a burst
  // with 403s — TJ_CONCURRENCY simultaneous calls is the ceiling. Every knob is
  // env-tunable so it can be dialled back without a deploy if the WAF complains.
  const HIDS_PER_PAGE = Math.max(1, Number(process.env.TJ_HIDS_PER_PAGE || 150));
  const CHUNK_SIZE = Math.max(1, Number(process.env.TJ_CHUNK_SIZE || 50));
  const CONCURRENCY = Math.max(1, Number(process.env.TJ_CONCURRENCY || 3));
  // Payload safety valve. Each page maps to a FIXED hid window so that page N+1
  // resumes exactly where page N stopped; the whole window is therefore always
  // scanned (never an early break on a hotel count, which would leave part of
  // the window unscanned and make the next page skip it). This only trims an
  // implausibly dense window before it bloats the response / DB enrichment.
  const MAX_PER_PAGE = Math.max(1, Number(process.env.TJ_MAX_PER_PAGE || 100));

  const startId = (page - 1) * HIDS_PER_PAGE;
  const endId = Math.min(startId + HIDS_PER_PAGE, hids.length);
  const pageHids = hids.slice(startId, endId);
  if (!pageHids.length) return { hotels: [], total: hids.length, hasMore: false };

  const chunks: string[][] = [];
  for (let i = 0; i < pageHids.length; i += CHUNK_SIZE) {
    chunks.push(pageHids.slice(i, i + CHUNK_SIZE));
  }

  try {
    const collectedHotels: any[] = [];
    console.log(
      `[TripJack] Pagination: Page ${page} scanning HIDs index ${startId}-${endId} ` +
        `(${chunks.length} chunk(s) × ${CHUNK_SIZE}, concurrency ${CONCURRENCY})`,
    );

    const nationalityId = await toTjNationality(req.countryCode ?? "IN");
    const fetchStartTime = Date.now();

    // Rooms are identical across chunks — build the shared part once.
    const rooms = req.rooms.map((r) => ({
      adults: Number(r.adults),
      children: Number(r.children || 0),
      childAge: r.childAges?.length ? r.childAges : undefined,
    }));

    const fetchChunk = (chunk: string[]): Promise<any[]> =>
      tripJackClient
        .post(
          "/hms/v3/hotel/listing",
          {
            checkIn: req.checkin,
            checkOut: req.checkout,
            rooms,
            currency: req.currency ?? "INR",
            nationality: nationalityId,
            hids: chunk.map((id) => parseInt(id)),
            correlationId,
          },
          { timeout: 15000, signal: req._abortSignal ?? undefined },
        )
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
        });

    // Scan the full window in waves of CONCURRENCY. The only early exit is the
    // request's partial-return window aborting us (the timeout path, which
    // already tolerates a partially-scanned tail); we never stop on a hotel
    // count, so the page→window mapping stays deterministic across scrolls.
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      if (req._abortSignal?.aborted) break;
      const wave = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(wave.map(fetchChunk));
      for (const found of results) collectedHotels.push(...found);
    }

    const finalHotels = collectedHotels.slice(0, MAX_PER_PAGE);
    console.log(
      `[TripJack] Fetch complete in ${Date.now() - fetchStartTime}ms. ` +
        `Returning ${finalHotels.length} hotels from ${pageHids.length} candidate ids.`,
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
          const finalAmenities = bh.amenities || [];

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
  const amenities: string[] = [];
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
  const finalAmenities = h.amenities || [];

  return {
    hotelId: `TJ:${hotelId}`,
    source: "TJ",
    name: h.name,
    address: h.address,
    city: h.city,
    country: h.country,
    // Diagnostic only — booking re-derives from the supplier's own response.
    markupRegion: deriveRegion(h.country),
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
    // `/hms/v3/hotel/listing` does NOT return a `cancellation` object — that only
    // arrives from the pricing call. So deriveRefundable almost always lands on
    // its unknown=true fallback here. Emitting that fallback's `false` made every
    // TJ card render a hard "Non-Refundable" it had no evidence for; send
    // undefined instead (same contract as the RG adapter) so the UI shows a
    // neutral state and the real policy surfaces on the detail page.
    isRefundable: refundable.unknown ? undefined : refundable.isRefundable,
    refundableLabel: refundable.unknown ? undefined : refundable.label,
    freeCancellationUntil: refundable.unknown ? undefined : refundable.freeCancellationUntil,
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
