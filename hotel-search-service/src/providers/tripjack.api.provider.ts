import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";
import { HotelModel } from "../models/Hotel.model";
import {
  buildPublicPricing,
  calculateEnrichedPricing,
  calculateNightsFromDates,
  deriveRefundable,
  platformMarkupAmount,
  round2,
} from "../utils/pricing.util";
import { resolveMarkupRules } from "../utils/auth";
import { toTjNationality } from "../utils/nationality";
import { LruCache } from "../utils/lruCache";

/** Full supplier request/response bodies. Multi-megabyte and pretty-printed — opt-in only. */
const DEBUG_PAYLOADS = process.env.HOTEL_DEBUG_PAYLOADS === "true";

/**
 * A hotel's static detail (name, images, room descriptions, policies) changes on
 * the order of weeks, but the detail page fetches it on every view. Caching it
 * takes a supplier round-trip out of the page load for every hotel a user
 * revisits or that two users open in the same window.
 */
const STATIC_DETAIL_TTL_MS = Number(
  process.env.TJ_STATIC_DETAIL_TTL_MS || 6 * 60 * 60 * 1000,
);
const staticDetailCache = new LruCache<any>(250, STATIC_DETAIL_TTL_MS);

/** Pricing is live inventory and can never be cached. Bound it well under the client's 60s default. */
const PRICING_TIMEOUT_MS = Number(process.env.TJ_PRICING_TIMEOUT_MS || 20_000);
const STATIC_DETAIL_TIMEOUT_MS = 8_000;

async function fetchStaticDetail(hid: string): Promise<any> {
  const cached = staticDetailCache.get(hid);
  if (cached) return cached;

  const res = await tripJackClient.post(
    "/hms/v3/hotel/static-detail",
    { hid },
    { timeout: STATIC_DETAIL_TIMEOUT_MS },
  );
  if (res.data) staticDetailCache.set(hid, res.data);
  return res.data;
}

export class TripJackApiProvider {
  async getNationalities() {
    try {
      const res = await tripJackClient.get("/hms/v3/nationality-info");
      return res.data;
    } catch (error: any) {
      console.error(
        "[TripJack] GetNationalities Error:",
        error.response?.status,
        error.message,
      );
      throw error;
    }
  }

  async getProducts(payload: any) {
    const rawId = (
      payload.hid ||
      payload.propertyId ||
      payload.PropertyId ||
      ""
    )
      .toString()
      .replace("TJ:", "")
      .replace("RG:", "")
      .trim();
    const correlationId = payload.correlationId || uuidv4();

    if (!rawId) {
      console.error(
        "[TripJack] GetProducts Error: No propertyId or hid provided in payload:",
        JSON.stringify(payload),
      );
      throw {
        status: 400,
        message:
          "propertyId or hid is required for TripJack detail/pricing request",
        data: { ErrorCode: 1012, description: "propertyId/hid is required." },
      };
    }

    const hidValue = rawId;
    const numericHid = /^\d+$/.test(hidValue) ? Number(hidValue) : hidValue;

    // ── Everything the pricing call doesn't depend on runs alongside it ──────
    // These used to be three serial round-trips (auth service, then Mongo, then
    // Mongo again) in front of the slowest call on the page.
    const token = payload.token || null;
    const nights = calculateNightsFromDates(
      payload.checkIn || payload.checkin,
      payload.checkOut || payload.checkout,
    );

    let localHotel: any = null;
    let staticData: any = null;

    const markupRulesPromise = resolveMarkupRules(
      payload.clientType === "B2B" ? "B2B" : "B2C",
      token,
    );
    const localHotelPromise = HotelModel.findOne({ tjHotelId: hidValue })
      .lean()
      .then((doc) => (localHotel = doc))
      .catch((err) => {
        console.warn(`[TripJack] Local hotel lookup failed: ${err.message}`);
        return null;
      });

    // Only the nationality id blocks the pricing payload.
    const tjPayload: any = {
      correlationId,
      hid: numericHid,
      checkIn: payload.checkin || payload.checkIn,
      checkOut: payload.checkout || payload.checkOut,
      rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
        const childrenCount =
          (r.Children !== undefined ? r.Children : r.children) ?? 0;
        const childAgeArr =
          r.childAge ||
          r.childrenAges ||
          r.childAges ||
          r.paxes?.map((p: any) => p.age) ||
          [];
        return {
          adults: Number(r.Adults || r.adults || 2),
          children: Number(childrenCount),
          childAge: childAgeArr.length > 0 ? childAgeArr : undefined,
        };
      }),
      currency: payload.Currency || payload.currency || "INR",
      nationality: await toTjNationality(
        payload.CountryCode || payload.countryCode || "IN",
      ),
    };

    let staticDetailPromise: Promise<void> | null = null;

    try {
      console.log(`[TripJack] Requesting pricing + static detail for ${rawId}`);
      if (DEBUG_PAYLOADS) {
        console.log(
          `[TripJack] Pricing payload:`,
          JSON.stringify(tjPayload, null, 2),
        );
      }

      staticDetailPromise = fetchStaticDetail(hidValue)
        .then((data) => {
          staticData = data;
        })
        .catch((err) => {
          console.warn(
            `[TripJack] Static detail background fetch warning:`,
            err.message,
          );
        });

      const pricingStartTime = Date.now();
      const pricingRes = await tripJackClient.post(
        "/hms/v3/hotel/pricing",
        tjPayload,
        { timeout: PRICING_TIMEOUT_MS },
      );
      console.log(
        `[TripJack] Pricing API resolved in ${Date.now() - pricingStartTime}ms`,
      );

      const [markupRules] = await Promise.all([
        markupRulesPromise,
        localHotelPromise,
      ]);

      if (!staticData) {
        // The DB copy already carries name/address/images/rating, so when we have
        // it the page can render without static-detail instead of stalling on it.
        const budgetMs = localHotel ? 1_200 : 3_000;
        await Promise.race([
          staticDetailPromise,
          new Promise((resolve) => setTimeout(resolve, budgetMs)),
        ]);
      }

      const pricingData = pricingRes.data;

      if (DEBUG_PAYLOADS) {
        console.log(
          `[DEBUG] TripJack Pricing Data for ${rawId}:`,
          JSON.stringify(pricingData, null, 1),
        );
        if (staticData) {
          console.log(
            `[DEBUG] TripJack Static Data for ${rawId}:`,
            JSON.stringify(staticData, null, 1),
          );
        }
      }
      const reviewHash: string = pricingData.reviewHash || "";

      const hotelName: string =
        pricingData.hotelName || staticData?.name || localHotel?.name || "";
      const hotelAmenities: string[] = staticData?.amenities
        ? Object.values(staticData.amenities).map((a: any) => a.name)
        : pricingData.amenities || [];

      const hotelImages: any[] = staticData?.images
        ? staticData.images
        : Array.isArray(pricingData.images) && pricingData.images.length
          ? pricingData.images
          : pricingData.img
            ? [pricingData.img]
            : localHotel?.images || [];

      const description =
        staticData?.descriptions?.default ||
        staticData?.desc ||
        pricingData.desc ||
        "";
      const address =
        staticData?.locale?.address?.fulladdr ||
        pricingData.address ||
        localHotel?.address ||
        "";
      const city =
        staticData?.locale?.address?.city ||
        pricingData.city ||
        localHotel?.cityName ||
        "";
      const starRating = staticData?.star_rating
        ? parseInt(staticData.star_rating)
        : pricingData.star_rating
          ? parseInt(pricingData.star_rating)
          : localHotel?.starRating;
      const checkInTime =
        staticData?.hotelInfo?.checkInTime ||
        staticData?.hotelInfo?.checkIn ||
        staticData?.checkInTime ||
        pricingData?.checkInTime ||
        "";
      const checkOutTime =
        staticData?.hotelInfo?.checkOutTime ||
        staticData?.hotelInfo?.checkOut ||
        staticData?.checkOutTime ||
        pricingData?.checkOutTime ||
        "";

      const hotelFacility = hotelAmenities.map((name) => ({
        facilityName: name,
      }));

      const options = (pricingData.options || []).map(
        (opt: any, idx: number) => {
          const optionAmenities: string[] = [
            ...new Set([...hotelAmenities, ...(opt.amenities || [])]),
          ];

          // Room image resolution
          const roomId = opt.roomInfo?.[0]?.id;
          const roomNameStr = (
            opt.roomInfo?.[0]?.name ||
            opt.name ||
            opt.roomName ||
            ""
          )
            .toLowerCase()
            .trim();
          let roomStatic: any = null;
          if (staticData?.rooms) {
            const staticRoomsArray = Object.values(staticData.rooms);
            roomStatic = staticRoomsArray.find(
              (r: any) => String(r?.id) === String(roomId),
            );
            if (
              !roomStatic ||
              !roomStatic.images ||
              roomStatic.images.length === 0
            ) {
              if (roomNameStr) {
                const matchingRooms = staticRoomsArray.filter((r: any) => {
                  const staticName = (r?.name || "").toLowerCase().trim();
                  return (
                    staticName &&
                    (staticName === roomNameStr ||
                      staticName.includes(roomNameStr) ||
                      roomNameStr.includes(staticName))
                  );
                });
                const roomWithImages = matchingRooms.find(
                  (r: any) =>
                    (r as any).images &&
                    Array.isArray((r as any).images) &&
                    (r as any).images.length > 0,
                ) as any;
                if (roomWithImages) {
                  // Copy rather than assign into roomStatic: it belongs to the
                  // cached static-detail document shared by every request for
                  // this hotel.
                  roomStatic = roomStatic
                    ? { ...roomStatic, images: roomWithImages.images }
                    : roomWithImages;
                } else if (!roomStatic && matchingRooms.length > 0) {
                  roomStatic = matchingRooms[0] as any;
                }
              }
            }
          }
          let roomImages: any[] = [];
          if (
            roomStatic?.images &&
            Array.isArray(roomStatic.images) &&
            roomStatic.images.length > 0
          ) {
            roomImages = roomStatic.images;
          } else if (
            opt.roomInfo?.[0]?.images &&
            Array.isArray(opt.roomInfo[0].images) &&
            opt.roomInfo[0].images.length > 0
          ) {
            roomImages = opt.roomInfo[0].images;
          }

          // ── Backend pricing enrichment (platform markup + agent markup + per-night) ──
          const rawTotalPrice = Number(opt.pricing?.totalPrice ?? 0);
          const rawBasePrice = Number(opt.pricing?.basePrice ?? rawTotalPrice);
          const rawTaxes = Number(opt.pricing?.taxes ?? 0);
          const rawMf = Number(opt.pricing?.mf ?? 0);
          const rawMft = Number(opt.pricing?.mft ?? 0);
          const rawCurrency = opt.pricing?.currency ?? "INR";

          // Platform (super-admin) markup baked into the net the agent sees ("api price").
          const platformAmt = platformMarkupAmount(rawBasePrice);
          const apiBasePrice = round2(rawBasePrice + platformAmt);
          const apiTotalPrice = round2(rawTotalPrice + platformAmt);

          const enriched = calculateEnrichedPricing(
            {
              basePrice: apiBasePrice,
              totalPrice: apiTotalPrice,
              taxes: rawTaxes,
              mf: rawMf,
              mft: rawMft,
              currency: rawCurrency,
            },
            markupRules,
            nights,
          );

          // Refundable status — TripJack provides an explicit flag; normalize the shape
          const refundable = deriveRefundable({
            explicit: opt.cancellation?.isRefundable,
            cancellationPolicies: opt.cancellation?.penalties,
          });

          const optionIdStr =
            opt.id || opt.optionId || `${payload.propertyId}-${idx}`;
          return {
            id: optionIdStr,
            optionId: optionIdStr,
            rateKey: optionIdStr,
            RoomSelectionKey: optionIdStr,
            reviewHash,
            correlationId,
            hid: rawId,

            name:
              opt.roomInfo?.[0]?.name || opt.roomName || `Option ${idx + 1}`,
            optionType: opt.optionType,
            roomInfo: (opt.roomInfo || []).map((ri: any) => ({
              ...ri,
              mealBasis: ri.mealBasis || opt.mealBasis || opt.boardName,
            })),
            inclusions: opt.inclusions || [],
            mealBasis: opt.mealBasis || opt.boardName,
            bookingNotes: opt.bookingNotes || null,

            // Backward-compat top-level price fields — now reflect enriched values
            price: enriched.finalTotalPrice,
            netPrice: enriched.basePrice,
            taxes: rawTaxes,
            managementFee: rawMf,
            managementFeeTax: rawMft,

            // Enriched pricing block — frontend reads ONLY these for display.
            // The canonical block must win over the spread: opt.pricing carries
            // the RAW supplier totals, which are below the api net whenever a
            // platform markup is configured.
            pricing: {
              ...opt.pricing,
              ...buildPublicPricing({
                enriched,
                taxes: rawTaxes,
                mf: rawMf,
                mft: rawMft,
                currency: rawCurrency,
                clientType: payload.clientType === "B2B" ? "B2B" : "B2C",
              }),
            },
            strikethrough: opt.pricing?.strikethrough,
            currency: rawCurrency,

            commercialType: opt.commercial?.type,
            commission: opt.commercial?.commission,

            compliance: opt.compliance,
            panRequired: opt.compliance?.panRequired ?? false,
            passportRequired: opt.compliance?.passportRequired ?? false,
            gstType: opt.compliance?.gstType,

            onHoldAllowed:
              opt.onHoldAllowed ??
              opt.cancellation?.onHoldAllowed ??
              opt.cancellation?.isRefundable ??
              false,
            holdConfirm:
              opt.holdConfirm ??
              opt.cancellation?.holdConfirm ??
              opt.cancellation?.isRefundable ??
              false,
            isRefundable: refundable.isRefundable,
            refundableLabel: refundable.label,
            freeCancellationUntil: refundable.freeCancellationUntil,
            cancellationPolicies: opt.cancellation?.penalties || [],

            amenities: optionAmenities,
            hotelFacility: optionAmenities.map((name: string) => ({
              facilityName: name,
            })),
            images: roomImages,
            bed_config:
              roomStatic?.bed_config || opt.roomInfo?.[0]?.bed_config || null,
            checkInTime,
            checkOutTime,
            rawOption: opt,
          };
        },
      );

      const productsMap: Record<string, any> = {};
      options.forEach((opt: any) => {
        let roomName = opt.name || "Default Room";
        if (opt.optionType === "CRSM" || opt.optionType === "CRCM") {
          roomName = "Mixed Rooms / Mixed Meals";
        }
        if (!productsMap[roomName]) {
          productsMap[roomName] = {
            name: roomName,
            roomCode: opt.roomInfo?.[0]?.id || roomName,
            images: opt.images?.length > 0 ? opt.images : [],
            rates: [],
          };
        }
        productsMap[roomName].rates.push(opt);
      });

      return {
        status: true,
        statusCode: 200,
        description: "Success",
        body: {
          hotelId: payload.propertyId,
          hid: rawId,
          name: hotelName,
          address,
          city,
          starRating,
          description,
          images: hotelImages,
          amenities: hotelAmenities,
          hotelFacility,
          checkInTime,
          checkOutTime,
          reviewHash,
          correlationId,
          policies:
            staticData?.policies ||
            staticData?.hotelInfo?.policies ||
            pricingData?.policies ||
            [],
          fees:
            staticData?.fees ||
            staticData?.hotelInfo?.fees ||
            pricingData?.fees ||
            [],
          checkInInstructions:
            staticData?.checkInInstructions ||
            staticData?.hotelInfo?.checkInInstructions ||
            pricingData?.checkInInstructions ||
            "",
          specialInstructions:
            staticData?.specialInstructions ||
            staticData?.hotelInfo?.specialInstructions ||
            pricingData?.specialInstructions ||
            "",
          location: {
            lat:
              staticData?.locale?.coordinates?.lat ||
              pricingData.coordinates?.lat ||
              pricingData.latitude,
            lng:
              staticData?.locale?.coordinates?.long ||
              pricingData.coordinates?.long ||
              pricingData.longitude,
          },
          products: Object.values(productsMap),
          options: options,
        },
      };
    } catch (error: any) {
      console.error(
        "[TripJack] GetProducts (Pricing) Error:",
        error.response?.status,
        error.response?.data || error.message,
      );

      if (
        error.response?.status === 400 &&
        error.response?.data?.options?.length === 0
      ) {
        console.log(`[TripJack] Hotel ${rawId} is sold out for these dates.`);
        // The sold-out response is built from localHotel, which may still be in
        // flight if pricing failed before the join above.
        await localHotelPromise;
        try {
          if (staticDetailPromise && !staticData) {
            await Promise.race([
              staticDetailPromise,
              new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);
          }
        } catch (e) {
          console.warn(
            "[TripJack] Failed to await static data in error block:",
            e,
          );
        }

        const hotelName: string =
          staticData?.name || localHotel?.name || "Sold Out Hotel";
        const hotelImages: string[] = staticData?.images
          ? staticData.images
              .map((img: any) => {
                const links = img.links || {};
                const firstLink = Object.values(links)[0] as any;
                return (
                  links["1000px"]?.href ||
                  links["default"]?.href ||
                  firstLink?.href
                );
              })
              .filter(Boolean)
          : localHotel?.images || [];

        return {
          status: true,
          statusCode: 200,
          description: "No availability for these dates",
          body: {
            hotelId: payload.propertyId,
            hid: rawId,
            name: hotelName,
            address:
              staticData?.locale?.address?.fulladdr ||
              localHotel?.address ||
              "",
            city:
              staticData?.locale?.address?.city || localHotel?.cityName || "",
            starRating: staticData?.star_rating
              ? parseInt(staticData.star_rating)
              : localHotel?.starRating || 0,
            description:
              staticData?.descriptions?.default ||
              staticData?.desc ||
              "No rooms available for your dates.",
            images: hotelImages,
            amenities: staticData?.amenities
              ? Object.values(staticData.amenities).map((a: any) => a.name)
              : [],
            hotelFacility: staticData?.amenities
              ? Object.values(staticData.amenities).map((a: any) => ({
                  facilityName: a.name,
                }))
              : [],
            checkInTime: staticData?.hotelInfo?.checkInTime || "",
            checkOutTime: staticData?.hotelInfo?.checkOutTime || "",
            reviewHash: "",
            correlationId: error.response.data.correlationId || correlationId,
            policies:
              staticData?.policies || staticData?.hotelInfo?.policies || [],
            fees: staticData?.fees || staticData?.hotelInfo?.fees || [],
            checkInInstructions:
              staticData?.checkInInstructions ||
              staticData?.hotelInfo?.checkInInstructions ||
              "",
            specialInstructions:
              staticData?.specialInstructions ||
              staticData?.hotelInfo?.specialInstructions ||
              "",
            location: {
              lat:
                staticData?.locale?.coordinates?.lat ||
                localHotel?.location?.coordinates?.[1] ||
                0,
              lng:
                staticData?.locale?.coordinates?.long ||
                localHotel?.location?.coordinates?.[0] ||
                0,
            },
            products: [],
            options: [],
          },
        };
      }

      throw error;
    }
  }
}
