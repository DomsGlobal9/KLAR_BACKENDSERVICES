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

        const flights = cachedData?.raw?.ONWARD || cachedData?.raw?.RETURN;

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

    async getReturnFares(sessionId: string, flightKey: string, segment: string) {

        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        if (segment !== "RETURN" && segment !== "ONWARD") {
            return null;
        }

        const flights = cachedData?.raw?.[segment];

        if (!Array.isArray(flights) || flights.length === 0) {
            throw new Error("No flights available for selected segment");
        }

        const selectedFlight = flights.find((flight: any) =>
            Array.isArray(flight?.sI) &&
            flight.sI.map((seg: any) => seg?.id).join("-") === flightKey
        );

        if (!selectedFlight) {
            throw new Error("Flight not found");
        }

        const fares = BaseFlightNormalizer.extractFares([selectedFlight]);

        if (!fares || fares.length === 0) {
            throw new Error("Fare extraction failed");
        }

        return TripjackFieldMapper.map(fares[0]);
    }

    async getMultiCityFares(
        sessionId: string,
        legIndex: number,
        flightKey: string
    ) {

        const cachedData = await RedisCacheService.get(sessionId);


        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const tripInfos = cachedData?.raw;

        if (!tripInfos) {
            throw new Error("Invalid session data");
        }

        const legFlights = tripInfos[String(legIndex)];

        if (!legFlights || !legFlights.length) {
            throw new Error("Leg not found");
        }

        const selectedFlight = legFlights.find((flight: any) =>
            flight.sI?.map((seg: any) => seg.id).join("-") === flightKey
        );

        if (!selectedFlight) {
            throw new Error("Flight not found for given leg");
        }

        const fares = BaseFlightNormalizer.extractFares([selectedFlight]);

        return TripjackFieldMapper.map(fares[0]);
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