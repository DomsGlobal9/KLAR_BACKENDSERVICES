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
        const rawId = (payload.hid || payload.propertyId || payload.PropertyId || "").toString().replace("TJ:", "").replace("RG:", "").trim();
        const correlationId = payload.correlationId || uuidv4();

        if (!rawId) {
            console.error("[TripJack] GetProducts Error: No propertyId or hid provided in payload:", JSON.stringify(payload));
            throw {
                status: 400,
                message: "propertyId or hid is required for TripJack detail/pricing request",
                data: { ErrorCode: 1012, description: "propertyId/hid is required." }
            };
        }

        const hidValue = rawId;
        const numericHid = /^\d+$/.test(hidValue) ? Number(hidValue) : hidValue;
        const tjPayload: any = {
            correlationId,
            hid: numericHid,
            checkIn: payload.checkin || payload.checkIn,
            checkOut: payload.checkout || payload.checkOut,
            rooms: (payload.Rooms || payload.rooms || []).map((r: any) => {
                const childrenCount = (r.Children !== undefined ? r.Children : r.children) ?? 0;
                const childAgeArr = (r.childAge || r.childrenAges || r.childAges || r.paxes?.map((p: any) => p.age) || []);
                return {
                    adults: Number(r.Adults || r.adults || 2),
                    children: Number(childrenCount),
                    childAge: childAgeArr.length > 0 ? childAgeArr : undefined,
                };
            }),
            currency: payload.Currency || payload.currency || "INR",
            nationality: await toTjNationality(payload.CountryCode || payload.countryCode || "IN"),
        };


        let localHotel: any = null;
        let staticData: any = null;
        let staticDetailPromise: Promise<void> | null = null;

        try {
            console.log(`[TripJack] Requesting Static Detail and Pricing for ${rawId}. Payload:`, JSON.stringify(tjPayload, null, 2));

            // Check local DB first for instant static metadata fallback
            localHotel = await HotelModel.findOne({ tjHotelId: hidValue }).lean();

            // Start static detail fetch in the background without blocking the pricing API response
            staticDetailPromise = tripJackClient.post("/hms/v3/hotel/static-detail", { hid: hidValue })
                .then(res => { staticData = res.data; })
                .catch(err => { console.warn(`[TripJack] Static detail background fetch warning:`, err.message); });

            // Await pricing request directly as the core requirement for room rates
            const pricingStartTime = Date.now();
            const pricingRes = await tripJackClient.post("/hms/v3/hotel/pricing", tjPayload);
            console.log(`[TripJack] Pricing API resolved in ${Date.now() - pricingStartTime}ms`);

            // If local cache is missing and staticData hasn't resolved yet, wait a brief grace period (max 500ms)
            if (!staticData && !localHotel) {
                await Promise.race([
                    staticDetailPromise,
                    new Promise(resolve => setTimeout(resolve, 500))
                ]);
            }

            const pricingData = pricingRes.data;

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

                const optionIdStr = opt.id || opt.optionId || `${payload.propertyId}-${idx}`;
                return {
                    id: optionIdStr,
                    optionId: optionIdStr,
                    rateKey: optionIdStr,
                    RoomSelectionKey: optionIdStr,
                    reviewHash,
                    correlationId,
                    hid: rawId,

                    name: (opt.roomInfo?.[0]?.name) || opt.roomName || `Option ${idx + 1}`,
                    optionType: opt.optionType,
                    roomInfo: (opt.roomInfo || []).map((ri: any) => ({
                        ...ri,
                        mealBasis: ri.mealBasis || opt.mealBasis || opt.boardName,
                    })),
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

                    compliance: opt.compliance,
                    panRequired: opt.compliance?.panRequired ?? false,
                    passportRequired: opt.compliance?.passportRequired ?? false,
                    gstType: opt.compliance?.gstType,

                    onHoldAllowed: opt.onHoldAllowed ?? opt.cancellation?.onHoldAllowed ?? (opt.cancellation?.isRefundable ?? false),
                    holdConfirm: opt.holdConfirm ?? opt.cancellation?.holdConfirm ?? (opt.cancellation?.isRefundable ?? false),
                    isRefundable: opt.cancellation?.isRefundable,
                    cancellationPolicies: opt.cancellation?.penalties || [],

                    amenities: optionAmenities,
                    hotelFacility: optionAmenities.map((name: string) => ({ facilityName: name })),
                    images: roomImages,
                    checkInTime,
                    checkOutTime,
                    rawOption: opt,
                };
            });

            // Restructure into "products" to match frontend/RateGain grouping
            const productsMap: Record<string, any> = {};
            options.forEach((opt: any) => {
                let roomName = opt.name || "Default Room";
                if (opt.optionType === 'CRSM' || opt.optionType === 'CRCM') {
                    roomName = "Mixed Rooms / Mixed Meals";
                }
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
            
            // Handle Sold-Out/Unavailable hotels gracefully
            // TripJack returns 400 with options: [] when a hotel has no availability for the given dates
            if (error.response?.status === 400 && error.response?.data?.options?.length === 0) {
                console.log(`[TripJack] Hotel ${rawId} is completely sold out or unavailable for these dates. Returning empty products array with static info.`);
                
                try {
                    // Try to wait for static detail to complete so we have the name and images
                    if (staticDetailPromise && !staticData) {
                        await Promise.race([
                            staticDetailPromise,
                            new Promise(resolve => setTimeout(resolve, 3000))
                        ]);
                    }
                } catch (e) {
                    console.warn("[TripJack] Failed to await static data in error block:", e);
                }

                const hotelName: string = staticData?.name || localHotel?.name || "Sold Out Hotel";
                const hotelImages: string[] = staticData?.images
                    ? staticData.images.map((img: any) => {
                        const links = img.links || {};
                        const firstLink = Object.values(links)[0] as any;
                        return links["1000px"]?.href || links["default"]?.href || firstLink?.href;
                    }).filter(Boolean)
                    : (localHotel?.images || []);

                return {
                    status: true,
                    statusCode: 200,
                    description: "No availability for these dates",
                    body: {
                        hotelId: payload.propertyId,
                        hid: rawId,
                        name: hotelName,
                        address: staticData?.locale?.address?.fulladdr || localHotel?.address || "",
                        city: staticData?.locale?.address?.city || localHotel?.cityName || "",
                        starRating: staticData?.star_rating ? parseInt(staticData.star_rating) : (localHotel?.starRating || 0),
                        description: staticData?.descriptions?.default || staticData?.desc || "This property currently has no rooms available for your selected dates. Please try different dates.",
                        images: hotelImages,
                        amenities: staticData?.amenities ? Object.values(staticData.amenities).map((a: any) => a.name) : [],
                        hotelFacility: staticData?.amenities ? Object.values(staticData.amenities).map((a: any) => ({ facilityName: a.name })) : [],
                        checkInTime: staticData?.hotelInfo?.checkInTime || "",
                        checkOutTime: staticData?.hotelInfo?.checkOutTime || "",
                        reviewHash: "",
                        correlationId: error.response.data.correlationId || correlationId,
                        location: { 
                            lat: staticData?.locale?.coordinates?.lat || localHotel?.location?.coordinates?.[1] || 0, 
                            lng: staticData?.locale?.coordinates?.long || localHotel?.location?.coordinates?.[0] || 0 
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
