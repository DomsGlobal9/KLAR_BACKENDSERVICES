import RedisCacheService from "../cache/redisCache.service";
import { BaseFlightNormalizer } from "../normalizers/baseFlight.normalizer";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";

class FareService {

    async getFares(sessionId: string, flightKey: string) {

        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const flights = cachedData?.raw?.ONWARD || [];

        const selectedFlight = flights.find((flight: any) =>
            flight.sI.map((seg: any) => seg.id).join("-") === flightKey
        );

        if (!selectedFlight) {
            throw new Error("Flight not found");
        }

        const fares = BaseFlightNormalizer.extractFares([selectedFlight]);

        const mappedResponse = TripjackFieldMapper.map(fares[0]);

        return mappedResponse;
    }
}

export default new FareService();