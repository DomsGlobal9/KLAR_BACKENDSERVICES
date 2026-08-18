import axios from "axios";
import RedisCacheService from "../cache/redisCache.service";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
import { BaseFlightNormalizer } from "../normalizers/baseFlight.normalizer";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";

class FareService {

    async getFares(sessionId: string, flightKey: string) {
        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const raw = cachedData?.raw;
        const flights: any[] = [];

        if (raw) {
            if (Array.isArray(raw.ONWARD)) flights.push(...raw.ONWARD);
            if (Array.isArray(raw.RETURN)) flights.push(...raw.RETURN);
            if (Array.isArray(raw.COMBO)) flights.push(...raw.COMBO);
            if (Array.isArray(raw)) flights.push(...raw);

            const tripInfos = raw?.searchResult?.tripInfos || raw?.tripInfos;
            if (tripInfos) {
                if (Array.isArray(tripInfos.ONWARD)) flights.push(...tripInfos.ONWARD);
                if (Array.isArray(tripInfos.RETURN)) flights.push(...tripInfos.RETURN);
                if (Array.isArray(tripInfos.COMBO)) flights.push(...tripInfos.COMBO);
            }
        }

        if (flights.length === 0) {
            throw new Error("No flight data found in session");
        }

        const selectedFlight = flights.find((flight: any) =>
            Array.isArray(flight?.sI) && flight.sI.map((seg: any) => seg?.id).join("-") === flightKey
        );

        if (!selectedFlight) {
            throw new Error("Flight not found");
        }

        const fares = BaseFlightNormalizer.extractFares([selectedFlight]);

        if (!fares || fares.length === 0) {
            throw new Error("Fare extraction failed");
        }

        const mappedResponse = TripjackFieldMapper.map(fares[0]);

        return mappedResponse;
    }

    async getReturnFares(sessionId: string, flightKey: string, segment: string) {
        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const tripInfos = cachedData?.raw;

        if (!tripInfos) {
            throw new Error("No flight data found");
        }

        const isDomestic = tripInfos.ONWARD && tripInfos.RETURN;
        const isInternational = tripInfos.COMBO;

        if (isDomestic) {
            if (segment !== "RETURN" && segment !== "ONWARD") {
                throw new Error("Invalid segment");
            }

            const flights = tripInfos[segment];

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

        if (isInternational) {
            const combos = tripInfos.COMBO;

            if (!Array.isArray(combos) || combos.length === 0) {
                throw new Error("No flights available");
            }

            const selectedCombo = combos.find((combo: any) => {
                const segments = combo.sI || [];
                const onwardSegments = segments.filter((seg: any) => !seg.isRs);
                const returnSegments = segments.filter((seg: any) => seg.isRs);
                const onwardKey = onwardSegments.map((seg: any) => seg?.id).join("-");
                const returnKey = returnSegments.map((seg: any) => seg?.id).join("-");

                return onwardKey === flightKey || returnKey === flightKey;
            });

            if (!selectedCombo) {
                throw new Error("Flight not found");
            }

            const fares = BaseFlightNormalizer.extractFaresForCombo(selectedCombo);

            if (!fares || fares.length === 0) {
                throw new Error("Fare extraction failed");
            }

            return TripjackFieldMapper.map(fares[0]);
        }

        throw new Error("Invalid flight data structure");
    }

    // async getMultiCityFares(
    //     sessionId: string,
    //     legIndex: number,
    //     flightKey: string
    // ) {
    //     const cachedData = await RedisCacheService.get(sessionId);

    //     if (!cachedData) {
    //         throw new Error("Session expired or invalid sessionId");
    //     }

    //     const tripInfos = cachedData?.raw;

    //     const isInternational = cachedData?.isInternational;

    //     if (!tripInfos) {
    //         throw new Error("Invalid session data");
    //     }

    //     if (isInternational) {
    //         const combos = tripInfos.COMBO;

    //         if (!combos || !combos.length) {
    //             throw new Error("No flights available");
    //         }

    //         const selectedCombo = combos.find((combo: any) => {
    //             const segments = combo.sI || [];
    //             const flightKeyToMatch = segments.map((seg: any) => seg.id).join("-");
    //             return flightKeyToMatch === flightKey;
    //         });

    //         if (!selectedCombo) {
    //             throw new Error("Flight not found");
    //         }

    //         const fares = BaseFlightNormalizer.extractFaresForCombo(selectedCombo);

    //         if (!fares || fares.length === 0) {
    //             throw new Error("Fare extraction failed");
    //         }

    //         return TripjackFieldMapper.map(fares[0]);
    //     }

    //     const legFlights = tripInfos[String(legIndex)];

    //     if (!legFlights || !legFlights.length) {
    //         throw new Error("Leg not found");
    //     }

    //     const selectedFlight = legFlights.find((flight: any) =>
    //         flight.sI?.map((seg: any) => seg.id).join("-") === flightKey
    //     );

    //     if (!selectedFlight) {
    //         throw new Error("Flight not found for given leg");
    //     }

    //     const fares = BaseFlightNormalizer.extractFares([selectedFlight]);

    //     if (!fares || fares.length === 0) {
    //         throw new Error("Fare extraction failed");
    //     }

    //     return TripjackFieldMapper.map(fares[0]);
    // }

    async getMultiCityFares(
        sessionId: string,
        legIndex: number,
        flightKey: string,
        priceId?: string
    ) {
        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new Error("Session expired or invalid sessionId");
        }

        const tripInfos = cachedData?.raw;
        const isInternational = cachedData?.isInternational;

        if (!tripInfos) {
            throw new Error("Invalid session data");
        }

        if (isInternational) {
            const combos = tripInfos.COMBO;

            if (!combos || !combos.length) {
                throw new Error("No flights available");
            }

            let selectedLeg = null;
            let selectedCombo = null;

            // Group with the same routeInfos the search response used, or the
            // split here won't match the flightKey the client was given.
            const targetDestinations =
                MultiCityNormalizer.extractTargetDestinations(cachedData?.searchQuery);

            // TripJack's segment ids are only unique *within* a combo — across a
            // response the same id is reused for unrelated flights, so a
            // flightKey like "507-508" matches several itineraries at different
            // prices. Whenever the caller knows which one it selected, identify
            // the combo by its priceId and only fall back to the ambiguous
            // flightKey match when it doesn't.
            const candidates = priceId
                ? combos.filter((combo: any) =>
                    (combo.totalPriceList || []).some((fare: any) => fare?.id === priceId))
                : combos;

            for (const combo of (candidates.length ? candidates : combos)) {
                const legs = this.extractLegsFromCombo(combo, targetDestinations);
                const leg = legs.find(leg =>
                    leg.legIndex === legIndex && leg.flightKey === flightKey
                );

                if (leg) {
                    selectedLeg = leg;
                    selectedCombo = combo;
                    break;
                }
            }

            if (!selectedLeg || !selectedCombo) {
                throw new Error(`Flight not found for leg ${legIndex}`);
            }

            // Extract fares for the specific leg
            const fares = this.extractFaresForLeg(selectedCombo, legIndex, targetDestinations);

            if (!fares) {
                throw new Error("Fare extraction failed");
            }

            return TripjackFieldMapper.map(fares);
        }

        // Domestic structure (your existing code)
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

        if (!fares || fares.length === 0) {
            throw new Error("Fare extraction failed");
        }

        return TripjackFieldMapper.map(fares[0]);
    }

    /**
     * Legs must be split exactly as MultiCityNormalizer split them when the
     * search response was built — the client looks a fare up by the flightKey
     * it was handed there. This used to split on `isRs`, which TripJack sets on
     * every segment of the onward journey, so a MAA→DOH leg keyed "576-577" was
     * looked for as "576-577-578" and 500'd with "Flight not found for leg 0".
     */
    private extractLegsFromCombo(combo: any, targetDestinations: string[] = []) {
        const segments = combo.sI || [];
        const grouped = MultiCityNormalizer.groupSegmentsIntoLegs(segments, targetDestinations);

        return Array.from(grouped.entries()).map(([legIndex, legSegments]) => ({
            legIndex,
            flightKey: legSegments.map((seg: any) => seg.id).join("-"),
            segments: [...legSegments]
        }));
    }


    private extractFaresForLeg(combo: any, legIndex: number, targetDestinations: string[] = []) {
        const segments = combo.sI || [];
        const grouped = MultiCityNormalizer.groupSegmentsIntoLegs(segments, targetDestinations);
        const legSegments = grouped.get(legIndex);

        if (!legSegments || !legSegments.length) return null;

        const fares = BaseFlightNormalizer.extractFares([
            { sI: legSegments, totalPriceList: combo.totalPriceList }
        ]);

        return fares[0] ?? null;
    }

    async getFareRule(flowType: string, id: string) {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.FARE_RULE}`;

        try {
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

        } catch (error: any) {
            console.error("Fare Rule ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new FareService();