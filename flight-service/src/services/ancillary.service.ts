import RedisCacheService from "../cache/redisCache.service";
import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config/tripjack.url.config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";

class AncillaryService {

    async getAncillaries(sessionId: string) {

        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const bookingId = cachedData?.raw?.bookingId;
        if (!bookingId) {
             console.warn("No bookingId found in cached session data, falling back to cached review trip info if possible.");
        }

        let tripInfos = cachedData?.raw?.TripInformation || [];

        if (bookingId) {
            const env = tripjackConfig.ENV;
            const config = TRIPJACK_URLS[env];
            const url = `${config.BASE_URL}${config.SSR}`;

            try {
                const ssrResponse = await axios.post(
                    url,
                    { bookingId },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            apikey: tripjackConfig.API_KEY,
                        }
                    }
                );

                if (ssrResponse.data && ssrResponse.data.tripInfos) {
                    const ssrMappedData = TripjackFieldMapper.map(ssrResponse.data);
                    if (ssrMappedData.TripInformation && ssrMappedData.TripInformation.length > 0) {
                        tripInfos = ssrMappedData.TripInformation;
                    }
                }
            } catch (error: any) {
                console.error("SSR API Error:", error.response?.data || error.message);
                // Fallback to whatever we have
            }
        }

        return tripInfos.map((trip: any) => ({
            totalPrice: trip.totalPriceInfo?.totalFareDetail?.FareComponents?.TotalFare,
            segments: (trip.SegmentInformation || []).map((seg: any) => ({
                segmentId: seg.SegmentID,
                flightNumber: `${seg.FlightDetails?.AirlineInfo?.AirlineCode} ${seg.FlightDetails?.FlightNumber}`,
                origin: seg.DepartureAirport?.city,
                destination: seg.ArrivalAirport?.city,
                departureTime: seg.DepartureTime,
                arrivalTime: seg.ArrivalTime,
                meals: (seg?.ssrInfo?.MEAL || []).map((m: any) => ({
                    code: m.AirlineCode,
                    price: m.amount,
                    description: m.Description,
                    isWCAG: m.iswca || false,
                })),
                baggage: (seg?.ssrInfo?.BAGGAGE || []).map((b: any) => ({
                    code: b.AirlineCode,
                    price: b.amount,
                    description: b.Description
                }))
            }))
        }));
    }
}

export default new AncillaryService();