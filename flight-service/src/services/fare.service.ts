import RedisCacheService from "../cache/redisCache.service";
import { BaseFlightNormalizer } from "../normalizers/baseFlight.normalizer";

class FareService {

    async getFares(sessionId: string, flightKey: string) {

        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const flights = cachedData?.raw?.ONWARD || [];

        console.log("Flights from cache:", flights);

        const selectedFlight = flights.find((flight: any) =>
            flight.sI.map((seg: any) => seg.id).join("-") === flightKey
        );

        console.log("Selected flight:", selectedFlight);

        if (!selectedFlight) {
            throw new Error("Flight not found");
        }

        const fares = BaseFlightNormalizer.extractFares([selectedFlight]);

        return fares[0];
    }
}

export default new FareService();