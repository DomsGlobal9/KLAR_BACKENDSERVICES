import { tripJackClient } from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";

import { NationalityModel } from "../models/Nationality.model";
import { HotelModel } from "../models/Hotel.model";

// Fallback map if DB is empty
const ISO_TO_TJ_COUNTRY_ID: Record<string, string> = {
    IN: "106", US: "232", GB: "235", AE: "231", SG: "200",
    MY: "131", AU: "14", CA: "40", DE: "83", FR: "76",
    JP: "112", CN: "45", NZ: "157", ZA: "204",
};

async function toTjNationality(iso: string): Promise<string> {
    try {
        if (!iso) return "106";
        const code = iso.toUpperCase();
        const found = await NationalityModel.findOne({ code }).select("countryId").lean();
        if (found) return found.countryId;
    } catch (err) {
        console.warn("[TripJack] Nationality DB lookup failed, using fallback.");
    }
    return ISO_TO_TJ_COUNTRY_ID[iso?.toUpperCase()] ?? "106";
}


export class TripJackApiProvider {
    /**
     * GET /hms/v3/nationality-info
     * Returns list of all supported nationalities.
     */
    async getNationalities() {
        try {
            const res = await tripJackClient.get("/hms/v3/nationality-info");
            return res.data;
        } catch (error: any) {
            console.error("[TripJack] GetNationalities Error:", error.response?.status, error.message);
            throw error;
        }
    }

    /**
     * FIX #2 + #3: Use POST /hms/v3/hotel/pricing (NOT /listing) for hotel detail.
     * reviewHash is a TOP-LEVEL field in the response, not per-option.
     * FIX #4 (partial): hid is sent here so the frontend can forward it to Review.
     */
    async getProducts(payload: any) {
        const rawId = (payload.propertyId || payload.PropertyId || "").toString().replace("TJ:", "").replace("RG:", "").trim();
        const correlationId = payload.correlationId || uuidv4();

        if (!rawId) {
            console.error("[TripJack] GetProducts Error: No propertyId provided in payload:", JSON.stringify(payload));
            throw {
                status: 400,
                message: "propertyId is required for TripJack detail/pricing request",
                data: { ErrorCode: 1012, description: "propertyId is required." }
            };
        }

        const hidValue = rawId;
        const tjPayload: any = {
            correlationId,
            hid: hidValue,
            hotelId: hidValue,
            checkIn: payload.checkin || payload.checkIn,
            checkOut: payload.checkout || payload.checkOut,
            rooms: (payload.Rooms || payload.rooms || []).map((r: any) => ({
                adults: r.Adults || r.adults || 2,
                children: (r.Children || r.children) ? Number(r.Children || r.children) : undefined,
                childAge: (r.childrenAges || r.childAges || r.paxes?.map((p: any) => p.age) || []).length
                    ? (r.childrenAges || r.childAges || r.paxes?.map((p: any) => p.age))
                    : undefined,
            })),
            currency: payload.Currency || payload.currency || "INR",
            nationality: await toTjNationality(payload.CountryCode || payload.countryCode || "IN"),
        };


        try {
            console.log(`[TripJack] Requesting Static Detail and Pricing for ${rawId}. Payload:`, JSON.stringify(tjPayload, null, 2));

            // Check local DB first for instant static metadata fallback
            const localHotel = await HotelModel.findOne({ tjHotelId: hidValue }).lean();

            // Set a short timeout (2500ms) on static-detail so it never blocks pricing display
            const staticDetailPromise = tripJackClient.post("/hms/v3/hotel/static-detail", { hid: hidValue, hotelId: hidValue });
            const fastStaticPromise = Promise.race([
                staticDetailPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error("Static detail fetch timeout")), 2500))
            ]);

            // Call both APIs in parallel
            const [staticRes, pricingRes] = await Promise.allSettled([
                fastStaticPromise,
                tripJackClient.post("/hms/v3/hotel/pricing", tjPayload)
            ]);

            if (staticRes.status === "rejected") {
                console.warn(`[TripJack] Static Detail timed out/failed for ${rawId}, using local cache fallback.`);
            }
            if (pricingRes.status === "rejected") {
                console.error(`[TripJack] Pricing Request Failed for ${rawId}:`, pricingRes.reason?.message, pricingRes.reason?.response?.data);
                throw pricingRes.reason;
            }

            const pricingData = pricingRes.value.data;
            const staticData = staticRes.status === "fulfilled" ? (staticRes.value as any).data : null;

            console.log(`[DEBUG] TripJack Pricing Data for ${rawId}:`, JSON.stringify(pricingData, null, 1));
            if (staticData) console.log(`[DEBUG] TripJack Static Data for ${rawId}:`, JSON.stringify(staticData, null, 1));
            const reviewHash: string = pricingData.reviewHash || "";

            // Merge static info if available or use local cache fallback
            const hotelName: string = pricingData.hotelName || staticData?.name || localHotel?.name || "";
            const hotelAmenities: string[] = staticData?.amenities
                ? Object.values(staticData.amenities).map((a: any) => a.name)
                : (pricingData.amenities || []);

            const hotelImages: string[] = staticData?.images
                ? staticData.images.map((img: any) => {
                    const links = img.links || {};
                    const firstLink = Object.values(links)[0] as any;
                    return links["1000px"]?.href || links["default"]?.href || firstLink?.href;
                }).filter(Boolean)
                : (Array.isArray(pricingData.images) && pricingData.images.length ? pricingData.images : (pricingData.img ? [pricingData.img] : (localHotel?.images || [])));

            const description = staticData?.descriptions?.default || staticData?.desc || pricingData.desc || "";
            const address = staticData?.locale?.address?.fulladdr || pricingData.address || localHotel?.address || "";
            const city = staticData?.locale?.address?.city || pricingData.city || localHotel?.cityName || "";
            const starRating = staticData?.star_rating ? parseInt(staticData.star_rating) : (pricingData.star_rating ? parseInt(pricingData.star_rating) : localHotel?.starRating);
            const checkInTime = staticData?.hotelInfo?.checkInTime || staticData?.hotelInfo?.checkIn || staticData?.checkInTime || pricingData?.checkInTime || "";
            const checkOutTime = staticData?.hotelInfo?.checkOutTime || staticData?.hotelInfo?.checkOut || staticData?.checkOutTime || pricingData?.checkOutTime || "";

            const hotelFacility = hotelAmenities.map(name => ({ facilityName: name }));

            const options = (pricingData.options || []).map((opt: any, idx: number) => {
                const optionAmenities: string[] = [
                    ...new Set([...hotelAmenities, ...(opt.amenities || [])]),
                ];

                // Try to find room-specific images in staticData
                const roomId = opt.roomInfo?.[0]?.id;
                const roomStatic = staticData?.rooms?.[roomId];
                let roomImages = []; // Strictly no fallback to hotelImages

                if (roomStatic?.images && Array.isArray(roomStatic.images) && roomStatic.images.length > 0) {
                    roomImages = roomStatic.images.map((img: any) => {
                        const links = img.links || {};
                        const firstLink = Object.values(links)[0] as any;
                        return links["1000px"]?.href || links["default"]?.href || firstLink?.href;
                    }).filter(Boolean);
                } else if (opt.roomInfo?.[0]?.images && Array.isArray(opt.roomInfo[0].images) && opt.roomInfo[0].images.length > 0) {
                    roomImages = opt.roomInfo[0].images;
                }

                return {
                    id: opt.optionId || `${payload.propertyId}-${idx}`,
                    optionId: opt.optionId,
                    rateKey: opt.optionId,
                    RoomSelectionKey: opt.optionId,
                    reviewHash,
                    correlationId,
                    hid: rawId,

                    name: (opt.roomInfo?.[0]?.name) || opt.roomName || `Option ${idx + 1}`,
                    optionType: opt.optionType,
                    roomInfo: opt.roomInfo || [],
                    inclusions: opt.inclusions || [],
                    mealBasis: opt.mealBasis || opt.boardName,
                    bookingNotes: opt.bookingNotes || null,

                    price: opt.pricing?.totalPrice,
                    netPrice: opt.pricing?.basePrice,
                    taxes: opt.pricing?.taxes,
                    managementFee: opt.pricing?.mf,
                    managementFeeTax: opt.pricing?.mft,
                    pricing: opt.pricing, // Pass the whole object for frontend breakup
                    strikethrough: opt.pricing?.strikethrough,
                    currency: opt.pricing?.currency,

                    commercialType: opt.commercial?.type,
                    commission: opt.commercial?.commission,

                    panRequired: opt.compliance?.panRequired ?? false,
                    passportRequired: opt.compliance?.passportRequired ?? false,
                    gstType: opt.compliance?.gstType,

                    onHoldAllowed: opt.onHoldAllowed ?? opt.cancellation?.onHoldAllowed ?? (opt.cancellation?.isRefundable ?? false),
                    holdConfirm: opt.holdConfirm ?? opt.cancellation?.holdConfirm ?? (opt.cancellation?.isRefundable ?? false),
                    isRefundable: opt.cancellation?.isRefundable,
                    cancellationPolicies: opt.cancellation?.penalties || [],

                    amenities: optionAmenities,
                    hotelFacility: optionAmenities.map(name => ({ facilityName: name })),
                    images: roomImages,
                    checkInTime,
                    checkOutTime,
                    rawOption: opt,
                };
            });

            // Restructure into "products" to match frontend/RateGain grouping
            const productsMap: Record<string, any> = {};
            options.forEach((opt: any) => {
                const roomName = opt.name || "Default Room";
                if (!productsMap[roomName]) {
                    productsMap[roomName] = {
                        name: roomName,
                        roomCode: opt.roomInfo?.[0]?.id || roomName,
                        images: opt.images?.length > 0 ? opt.images : [], // Strictly no fallback
                        rates: []
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
                    location: {
                        lat: staticData?.locale?.coordinates?.lat || pricingData.coordinates?.lat || pricingData.latitude,
                        lng: staticData?.locale?.coordinates?.long || pricingData.coordinates?.long || pricingData.longitude,
                    },
                    products: Object.values(productsMap),
                    options: options, // keep for backward compat
                },
            };
        } catch (error: any) {
            console.error("[TripJack] GetProducts (Pricing) Error:", error.response?.status, error.response?.data || error.message);
            throw error;
        }
    }
}
