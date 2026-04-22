import RedisCacheService from "../cache/redisCache.service";

class AncillaryService {

    async getAncillaries(sessionId: string) {

        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const tripInfos = cachedData?.raw?.TripInformation || [];

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