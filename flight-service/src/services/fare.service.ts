import axios from "axios";
import RedisCacheService from "../cache/redisCache.service";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
import { BaseFlightNormalizer } from "../normalizers/baseFlight.normalizer";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";
import { logFlightEvent } from "../utils/flightLog.util";
import { findMulticityOption } from "../utils/multicitySelection.util";
import {
    MulticityOption,
    MulticitySelectionError,
    MulticitySelectionIndex
} from "../types/multicity.types";

export interface MultiCityFareQuery {
    sessionId: string;
    optionId?: string;
    legIndex?: number;
    flightKey?: string;
    priceId?: string;
}

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

    private resolveSourceFlight(tripInfos: any, option: MulticityOption): any {
        const source = option.sourceType === "TRIPJACK_COMBO"
            ? tripInfos?.COMBO?.[option.sourceIndex]
            : tripInfos?.[String(option.routeIndex)]?.[option.sourceIndex];

        if (!source) {
            throw new MulticitySelectionError(
                "The selected flight is no longer available in this search session.",
                "SOURCE_NOT_IN_SESSION",
                { optionId: option.optionId, sourceIndex: option.sourceIndex }
            );
        }

        const expectedIds = option.legs.flatMap((leg) => leg.segmentIds).join("-");
        const actualIds = (source.sI || []).map((seg: any) => seg?.id).join("-");

        if (expectedIds !== actualIds) {
            throw new MulticitySelectionError(
                "The selected flight no longer matches the cached search result.",
                "SOURCE_MISMATCH",
                { optionId: option.optionId }
            );
        }

        return source;
    }

    async getMultiCityFares(query: MultiCityFareQuery) {
        const { sessionId, legIndex, flightKey, priceId } = query;

        const cachedData = await RedisCacheService.get(sessionId);

        if (!cachedData) {
            throw new MulticitySelectionError(
                "Session expired or invalid sessionId",
                "SESSION_EXPIRED",
                { sessionId }
            );
        }

        const tripInfos = cachedData?.raw;
        const selection: MulticitySelectionIndex | undefined = cachedData?.multicitySelection;

        if (!tripInfos) {
            throw new MulticitySelectionError("Invalid session data", "SESSION_EMPTY", { sessionId });
        }

        logFlightEvent("FARE_REQUEST", {
            sessionId,
            searchType: "MULTICITY",
            mode: selection?.mode,
            optionId: query.optionId,
            legIndex,
            flightKey,
            priceId
        });

        if (selection) {
            const option = findMulticityOption(selection, query);

            if (!option) {
                throw new MulticitySelectionError(
                    "The selected flight was not found in this search session.",
                    "OPTION_NOT_FOUND",
                    { optionId: query.optionId, flightKey, legIndex }
                );
            }

            if (priceId && !option.priceIds.includes(priceId)) {
                throw new MulticitySelectionError(
                    "priceId does not belong to the selected flight.",
                    "PRICE_ID_NOT_IN_OPTION",
                    { optionId: option.optionId, priceId }
                );
            }

            const source = this.resolveSourceFlight(tripInfos, option);
            const fares = this.extractFaresForOption(source, option, legIndex);

            if (!fares) {
                throw new MulticitySelectionError(
                    "Fare extraction failed",
                    "FARE_EXTRACTION_FAILED",
                    { optionId: option.optionId, legIndex }
                );
            }

            logFlightEvent("FARE_RESPONSE", {
                sessionId,
                searchType: "MULTICITY",
                mode: selection.mode,
                optionId: option.optionId,
                sourceIndex: option.sourceIndex,
                routeIndex: option.routeIndex,
                priceIds: option.priceIds
            });

            return TripjackFieldMapper.map(fares);
        }

        return this.getMultiCityFaresLegacy(cachedData, legIndex, flightKey, priceId);
    }

    private extractFaresForOption(source: any, option: MulticityOption, legIndex?: number) {
        if (option.sourceType === "TRIPJACK_ROUTE" || legIndex === undefined) {
            const fares = BaseFlightNormalizer.extractFares([source]);
            return fares[0] ?? null;
        }

        const displayLeg = option.legs.find((leg) => leg.legIndex === legIndex);
        if (!displayLeg) return null;

        const segmentIds = new Set(displayLeg.segmentIds);
        const legSegments = (source.sI || []).filter((seg: any) => segmentIds.has(seg?.id));

        if (!legSegments.length) return null;

        const fares = BaseFlightNormalizer.extractFares([
            { sI: legSegments, totalPriceList: source.totalPriceList }
        ]);

        return fares[0] ?? null;
    }

    private async getMultiCityFaresLegacy(
        cachedData: any,
        legIndex?: number,
        flightKey?: string,
        priceId?: string
    ) {
        const tripInfos = cachedData?.raw;
        const isInternational = cachedData?.isInternational;

        if (legIndex === undefined || !flightKey) {
            throw new MulticitySelectionError(
                "legIndex and flightKey are required for this session.",
                "LEGACY_SELECTION_INCOMPLETE"
            );
        }

        if (isInternational) {
            const combos = tripInfos.COMBO;

            if (!combos || !combos.length) {
                throw new Error("No flights available");
            }

            let selectedLeg = null;
            let selectedCombo = null;

            const targetDestinations =
                MultiCityNormalizer.extractTargetDestinations(cachedData?.searchQuery);

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

            const fares = this.extractFaresForLeg(selectedCombo, legIndex, targetDestinations);

            if (!fares) {
                throw new Error("Fare extraction failed");
            }

            return TripjackFieldMapper.map(fares);
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

        if (!fares || fares.length === 0) {
            throw new Error("Fare extraction failed");
        }

        return TripjackFieldMapper.map(fares[0]);
    }

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