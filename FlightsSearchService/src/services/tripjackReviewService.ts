import axios from "axios";
import { envConfig, getTripJackEndpoint } from "../config/env";
import { getCache, setCache } from "./redisService";
import { TripJackRawModel } from "../models/tripJackRaw.model";
import { ReviewError, ReviewRequest, ReviewResponse, TransformedReviewFareOption, TransformedReviewFlight, TransformedReviewPrice } from "../interface/flight/review.interface";

export const getReviewFromTripJack = async (payload: ReviewRequest): Promise<ReviewResponse> => {
    const cacheKey = `review:${JSON.stringify(payload)}`;
    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);

    console.log("The review payload we get", JSON.stringify(payload, null, 2));

    try {
        const url = getTripJackEndpoint('REVIEW');
        console.log("The url we get", url);

        const response = await axios.post(
            url,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: envConfig.TRIPJACK.API_KEY,
                },
                // timeout: 300000,
            }
        );

        await setCache(
            cacheKey,
            JSON.stringify(response.data),
            envConfig.TRIPJACK.CACHE_TTL
        );

        return response.data as ReviewResponse;

    } catch (error: any) {
        console.error("❌ REVIEW API ERROR:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw error;
    }
};

const extractMealsForSegment = (segment: any): Array<{ code: string; amount: number; desc: string; iswca: boolean }> => {
    console.log(`🍽️ Extracting meals for segment ${segment.id}:`, {
        hasMeals: !!segment.ssrInfo?.MEAL,
        mealCount: segment.ssrInfo?.MEAL?.length || 0
    });

    if (segment.ssrInfo?.MEAL && segment.ssrInfo.MEAL.length > 0) {
        return segment.ssrInfo.MEAL.map((meal: any) => ({
            code: meal.code,
            amount: meal.amount || 0,
            desc: meal.desc,
            iswca: meal.iswca || false
        }));
    }
    return [];
};

const extractBaggageForSegment = (segment: any): Array<{ code: string; amount?: number; desc: string; iswca: boolean }> => {
    console.log(`🛄 Extracting baggage for segment ${segment.id}:`, {
        hasBaggage: !!segment.ssrInfo?.BAGGAGE,
        baggageCount: segment.ssrInfo?.BAGGAGE?.length || 0
    });

    if (segment.ssrInfo?.BAGGAGE && segment.ssrInfo.BAGGAGE.length > 0) {
        return segment.ssrInfo.BAGGAGE.map((baggage: any) => ({
            code: baggage.code,
            amount: baggage.amount,
            desc: baggage.desc,
            iswca: baggage.iswca || false
        }));
    }
    return [];
};

const buildFareOptionForSegment = (fare: any, segment: any): TransformedReviewFareOption => {
    const adult = fare.fd.ADULT;
    const child = fare.fd.CHILD;
    const infant = fare.fd.INFANT;

    const baggageInfo = fare.tai?.tbi?.[segment.id]?.[0]?.ADULT || adult.bI;
    const childBaggageInfo = fare.tai?.tbi?.[segment.id]?.[1]?.CHILD || child?.bI;
    const infantBaggageInfo = fare.tai?.tbi?.[segment.id]?.[2]?.INFANT || infant?.bI;

    const getBaggage = (info: any): { checked: string; cabin: string } => {
        return {
            checked: info?.iB || adult.bI?.iB || 'Not Specified',
            cabin: info?.cB || adult.bI?.cB || 'Not Specified',
        };
    };

    const getChildBaggage = (info: any): { checked: string; cabin: string } | undefined => {
        if (!child) return undefined;
        return {
            checked: info?.iB || child.bI?.iB || 'Not Specified',
            cabin: info?.cB || child.bI?.cB || 'Not Specified',
        };
    };

    const getInfantBaggage = (info: any): { checked: string; cabin: string } | undefined => {
        if (!infant) return undefined;
        return {
            checked: info?.iB || infant.bI?.iB || 'Not Specified',
            cabin: info?.cB || infant.bI?.cB || 'Not Specified',
        };
    };

    const meals = extractMealsForSegment(segment);
    const baggageOptions = extractBaggageForSegment(segment);

    const mealsBySegment: Record<string, Array<any>> = {};
    if (meals.length > 0) {
        mealsBySegment[segment.id] = meals;
    }

    const baggageBySegment: Record<string, Array<any>> = {};
    if (baggageOptions.length > 0) {
        baggageBySegment[segment.id] = baggageOptions;
    }

    return {
        fareId: fare.id,
        fareIdentifier: fare.fareIdentifier,
        cabinClass: adult.cc || 'ECONOMY',
        bookingClass: adult.cB || '',
        fareBasis: adult.fB || '',
        baseFare: adult.fC?.BF || 0,
        taxesAndFees: adult.fC?.TAF || 0,
        totalFare: adult.fC?.TF || 0,
        netFare: adult.fC?.NF || 0,
        refundable: adult.rT === 1,
        baggage: getBaggage(baggageInfo),
        seatAvailability: adult.sR || 0,
        meals: mealsBySegment,
        baggageOptions: baggageBySegment,
        passengerBreakdown: {
            adult: adult ? {
                baseFare: adult.fC?.BF || 0,
                taxesAndFees: adult.fC?.TAF || 0,
                totalFare: adult.fC?.TF || 0,
            } : undefined,
            child: child ? {
                baseFare: child.fC?.BF || 0,
                taxesAndFees: child.fC?.TAF || 0,
                totalFare: child.fC?.TF || 0,
                baggage: getChildBaggage(childBaggageInfo),
            } : undefined,
            infant: infant ? {
                baseFare: infant.fC?.BF || 0,
                taxesAndFees: infant.fC?.TAF || 0,
                totalFare: infant.fC?.TF || 0,
                baggage: getInfantBaggage(infantBaggageInfo),
            } : undefined,
        },
        fareBreakdown: adult.afC?.TAF ? {
            managementFee: adult.afC.TAF.MFT,
            otherTax: adult.afC.TAF.OT,
            serviceTax: adult.afC.TAF.AGST,
            airportTax: adult.afC.TAF.MF,
            fuelSurcharge: adult.afC.TAF.YQ,
        } : undefined,
    };
};

const buildFlightFromSegment = (segment: any, fare: any): TransformedReviewFlight => {
    const fareOption = buildFareOptionForSegment(fare, segment);

    return {
        segmentId: segment.id,
        flightNumber: segment.fD.fN,
        airline: {
            code: segment.fD.aI.code,
            name: segment.fD.aI.name,
            isLcc: segment.fD.aI.isLcc,
        },
        departure: {
            airportCode: segment.da.code,
            airportName: segment.da.name,
            time: new Date(segment.dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date(segment.dt).toLocaleDateString(),
            datetime: segment.dt,
        },
        arrival: {
            airportCode: segment.aa.code,
            airportName: segment.aa.name,
            time: new Date(segment.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date(segment.at).toLocaleDateString(),
            datetime: segment.at,
        },
        duration: segment.duration,
        stops: segment.stops || 0,
        fareOptions: [fareOption],
    };
};

const processTripInfo = (tripInfo: any): TransformedReviewFlight[] => {
    const segments = tripInfo.sI;
    const fare = tripInfo.totalPriceList[0];

    console.log(`✈️ PROCESSING TRIP with ${segments.length} segments`);
    console.log(`📋 Single fare option will be applied to each segment separately`);

    const flights = segments.map((segment: any) => buildFlightFromSegment(segment, fare));

    return flights;
};

const buildPassengerSummary = (searchQuery: any) => {
    const adult = searchQuery?.paxInfo?.ADULT || 1;
    const child = searchQuery?.paxInfo?.CHILD || 0;
    const infant = searchQuery?.paxInfo?.INFANT || 0;

    return {
        adult,
        child,
        infant,
        totalPassengers: adult + child + infant
    };
};

const buildTotalPrice = (totalPriceInfo: any) => {
    const totalFare = totalPriceInfo?.totalFareDetail?.fC || { TF: 0, BF: 0, TAF: 0, NF: 0 };
    const fareBreakdown = totalPriceInfo?.totalFareDetail?.afC?.TAF;

    return {
        baseFare: totalFare.BF || 0,
        taxesAndFees: totalFare.TAF || 0,
        totalFare: totalFare.TF || 0,
        netFare: totalFare.NF || 0,
        breakdown: fareBreakdown ? {
            otherTax: fareBreakdown.OT,
            serviceTax: fareBreakdown.AGST,
        } : undefined,
    };
};

export const transformReviewResponse = (
    response: ReviewResponse,
    originalRequest: ReviewRequest
): TransformedReviewPrice => {
    console.log('🔍 STARTING TRANSFORMATION');
    console.log('📊 RAW TRIP INFOS COUNT:', response.tripInfos.length);

    const flights = response.tripInfos.map((tripInfo) => processTripInfo(tripInfo)).flat();

    console.log('✅ FINAL TRANSFORMATION RESULT:');
    flights.forEach(flight => {
        console.log(`  Flight ${flight.segmentId}:`, {
            mealSegments: Object.keys(flight.fareOptions[0]?.meals || {}),
            baggageSegments: Object.keys(flight.fareOptions[0]?.baggageOptions || {})
        });
    });

    return {
        bookingId: response.bookingId,
        totalPrice: buildTotalPrice(response.totalPriceInfo),
        flights: flights,
        passengerSummary: buildPassengerSummary(response.searchQuery),
    };
};

export const validateReviewRequest = (priceIds: any): priceIds is string[] => {
    if (!Array.isArray(priceIds)) return false;
    if (priceIds.length === 0) return false;
    return priceIds.every(id => typeof id === 'string' && id.trim().length > 0);
};

export const getBatchReview = async (
    requests: ReviewRequest[]
): Promise<(TransformedReviewPrice | ReviewError)[]> => {
    const promises = requests.map(async (request) => {
        try {
            const response = await getReviewFromTripJack(request);
            return transformReviewResponse(response, request);
        } catch (error: any) {
            return {
                id: request.priceIds.join(','),
                error: error.message || "Failed to fetch review",
            };
        }
    });

    return Promise.all(promises);
};