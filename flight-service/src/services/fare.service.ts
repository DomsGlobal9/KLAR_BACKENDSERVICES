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
        flightKey: string
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

            for (const combo of combos) {
                const legs = this.extractLegsFromCombo(combo);
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
            const fares = this.extractFaresForLeg(selectedCombo, legIndex);

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

    private extractLegsFromCombo(combo: any) {
        const segments = combo.sI || [];
        const legs = [];
        let currentLeg = 0;
        let currentLegSegments = [];

        for (let i = 0; i < segments.length; i++) {
            currentLegSegments.push(segments[i]);

            if (segments[i].isRs === true || i === segments.length - 1) {
                const flightKey = currentLegSegments.map((seg: any) => seg.id).join("-");
                legs.push({
                    legIndex: currentLeg,
                    flightKey: flightKey,
                    segments: [...currentLegSegments]
                });

                currentLeg++;
                currentLegSegments = [];
            }
        }

        return legs;
    }


    private extractFaresForLeg(combo: any, legIndex: number) {
        const segments = combo.sI || [];
        let currentLeg = 0;
        let currentLegSegments = [];

        for (let i = 0; i < segments.length; i++) {
            currentLegSegments.push(segments[i]);

            if (segments[i].isRs === true || i === segments.length - 1) {
                if (currentLeg === legIndex) {
                    const flightObj = {
                        sI: currentLegSegments,
                        totalPriceList: combo.totalPriceList
                    };
                    const fares = BaseFlightNormalizer.extractFares([flightObj]);
                    return fares[0];
                }

                currentLeg++;
                currentLegSegments = [];
            }
        }

        return null;
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