import axios from "axios";
import { envConfig, getTripJackEndpoint } from "../config/env";
import { getCache, setCache } from "./redisService";
import { TripJackRawModel } from "../models/tripJackRaw.model";
import { ReviewError, ReviewRequest, ReviewResponse, TransformedReviewFareOption, TransformedReviewFlight, TransformedReviewPrice } from "../interface/flight/review.interface";


/**
 * Get price review from TripJack using price IDs
 */
export const getReviewFromTripJack = async (payload: ReviewRequest): Promise<ReviewResponse> => {
    const cacheKey = `review:${JSON.stringify(payload)}`;

    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
        const url = getTripJackEndpoint('REVIEW');

        console.log("🔍 Calling TripJack Review API:", {
            url,
            priceIdsCount: payload.priceIds.length
        });

        const response = await axios.post(
            url,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: envConfig.TRIPJACK.API_KEY,
                },
                timeout: envConfig.TRIPJACK.TIMEOUT,
            }
        );

        await TripJackRawModel.create({
            provider: "TRIPJACK",
            endpoint: "REVIEW",
            requestPayload: payload,
            responsePayload: response.data,
            searchKey: cacheKey,
        }).catch((err) => {
            console.error("Failed to store TripJack raw data", err);
        });

        await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);

        return response.data as ReviewResponse;
    } catch (error: any) {
        console.error("❌ TripJack Review API Error:", {
            endpoint: getTripJackEndpoint('REVIEW'),
            error: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw error;
    }
};

/**
 * Transform review response to frontend-friendly format
 */
export const transformReviewResponse = (
    response: ReviewResponse,
    originalRequest: ReviewRequest
): TransformedReviewPrice => {

    const totalFare = response.totalPriceInfo?.totalFareDetail?.fC || { TF: 0, BF: 0, TAF: 0, NF: 0 };
    const fareBreakdown = response.totalPriceInfo?.totalFareDetail?.afC?.TAF;

    const passengerSummary = {
        adult: response.searchQuery?.paxInfo?.ADULT || 1,
        child: response.searchQuery?.paxInfo?.CHILD || 0,
        infant: response.searchQuery?.paxInfo?.INFANT || 0,
        totalPassengers: 0
    };
    passengerSummary.totalPassengers = passengerSummary.adult + passengerSummary.child + passengerSummary.infant;


    const flights: TransformedReviewFlight[] = response.tripInfos.map((tripInfo, index) => {
        const segment = tripInfo.sI[0];

        const departureDate = new Date(segment.dt);
        const arrivalDate = new Date(segment.at);

        const fareOptions: TransformedReviewFareOption[] = tripInfo.totalPriceList.map(f => {
            const adult = f.fd.ADULT;
            const child = f.fd.CHILD;
            const infant = f.fd.INFANT;

            const baggageInfo = f.tai?.tbi?.[segment.id]?.[0]?.ADULT || adult.bI;
            const childBaggageInfo = f.tai?.tbi?.[segment.id]?.[1]?.CHILD || child?.bI;
            const infantBaggageInfo = f.tai?.tbi?.[segment.id]?.[2]?.INFANT || infant?.bI;

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

            return {
                fareId: f.id,
                fareIdentifier: f.fareIdentifier,
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
                    fuelSurcharge: adult.afC.TAF.YR,
                } : undefined,
            };
        });

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
                time: departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                date: departureDate.toLocaleDateString(),
                datetime: segment.dt,
            },
            arrival: {
                airportCode: segment.aa.code,
                airportName: segment.aa.name,
                time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                date: arrivalDate.toLocaleDateString(),
                datetime: segment.at,
            },
            duration: segment.duration,
            stops: segment.stops || 0,
            fareOptions,
        };
    });

    return {
        bookingId: response.bookingId,
        totalPrice: {
            baseFare: totalFare.BF || 0,
            taxesAndFees: totalFare.TAF || 0,
            totalFare: totalFare.TF || 0,
            netFare: totalFare.NF || 0,
            breakdown: fareBreakdown ? {
                otherTax: fareBreakdown.OT,
                serviceTax: fareBreakdown.AGST,
            } : undefined,
        },
        flights,
        passengerSummary,
    };
};

/**
 * Validate review request
 */
export const validateReviewRequest = (priceIds: any): priceIds is string[] => {
    if (!Array.isArray(priceIds)) return false;
    if (priceIds.length === 0) return false;
    return priceIds.every(id => typeof id === 'string' && id.trim().length > 0);
};

/**
 * Get batch review for multiple price ID sets
 */
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