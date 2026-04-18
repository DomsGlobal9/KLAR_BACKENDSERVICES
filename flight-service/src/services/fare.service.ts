import axios from "axios";
import RedisCacheService from "../cache/redisCache.service";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
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

    async getFareRule(flowType: string, id: string) {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.FARE_RULE}`;

        const response = await axios.post(
            url,
            {
                flowType: flowType,
                id: id
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
                // timeout: 15000,
            }
        );

        const rawData = response.data;

        const mappedData = TripjackFieldMapper.map(rawData);

        return mappedData;
    }
}

export default new FareService();