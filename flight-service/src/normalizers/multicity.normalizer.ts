import { BaseFlightNormalizer } from "./baseFlight.normalizer";
import { envConfig } from "../config/env.config";
import { logFlightEvent } from "../utils/flightLog.util";
import {
    MulticityDisplayLeg,
    MulticityOption,
    MulticityOptionFare,
    MulticityRejection,
    MulticityRoute,
    MulticitySelectionIndex
} from "../types/multicity.types";

type AnyObj = Record<string, any>;

export class MultiCityNormalizer extends BaseFlightNormalizer {

    static normalize(searchResult: AnyObj, searchQuery?: AnyObj) {
        const tripInfos = searchResult?.searchResult?.tripInfos;
        const routes = this.buildRoutes(searchQuery);

        if (!tripInfos) {
            logFlightEvent("NORMALIZATION_RESULT", {
                searchType: "MULTICITY",
                supplierInventory: 0,
                optionsCreated: 0,
                reason: "NO_TRIP_INFOS"
            });
            return {
                flights: [],
                airlineStats: [],
                selection: this.emptySelection(routes)
            };
        }

        const hasCombo = Array.isArray(tripInfos.COMBO);
        const hasLegs = Object.keys(tripInfos).some(key => !isNaN(Number(key)));

        if (hasCombo && !hasLegs) {
            return this.normalizeComboStructure(tripInfos.COMBO, routes);
        }

        return this.normalizeDomesticStructure(tripInfos, routes);
    }

    static transformWithAllFares(searchResult: AnyObj, searchQuery?: AnyObj) {
        const tripInfos = searchResult?.searchResult?.tripInfos;
        if (!tripInfos) {
            return {
                flights: [],
                type: 'none'
            };
        }

        const hasCombo = Array.isArray(tripInfos.COMBO);
        const hasLegs = Object.keys(tripInfos).some(key => !isNaN(Number(key)));

        if (hasCombo && !hasLegs) {
            return this.transformComboWithAllFares(tripInfos.COMBO, this.buildRoutes(searchQuery));
        }

        return this.transformDomesticWithAllFares(tripInfos);
    }

    static buildRoutes(searchQuery?: AnyObj): MulticityRoute[] {
        const routeInfos = searchQuery?.routeInfos || searchQuery?.searchQuery?.routeInfos;
        if (!Array.isArray(routeInfos)) return [];

        return routeInfos.map((route: any, routeIndex: number) => ({
            routeIndex,
            from: route?.fromCityOrAirport?.code || route?.from || '',
            to: route?.toCityOrAirport?.code || route?.to || '',
            travelDate: route?.travelDate || ''
        }));
    }

    static extractTargetDestinations(searchQuery?: AnyObj): string[] {
        return this.buildRoutes(searchQuery)
            .map((route) => route.to)
            .filter(Boolean);
    }

    private static emptySelection(routes: MulticityRoute[]): MulticitySelectionIndex {
        return {
            mode: "DOMESTIC",
            selectionMode: "PER_ROUTE",
            routes,
            options: [],
            unmappable: []
        };
    }

    private static extractOptionFares(totalPriceList: any[]): MulticityOptionFare[] {
        return (totalPriceList || [])
            .filter((fare: any) => fare?.id)
            .map((fare: any) => ({
                priceId: fare.id,
                fareIdentifier: fare.fareIdentifier ?? null,
                totalPrice: fare?.fd?.ADULT?.fC?.originalTF ?? fare?.fd?.ADULT?.fC?.TF ?? 0
            }));
    }

    private static cheapestPriceId(fares: MulticityOptionFare[]): string | null {
        if (!fares.length) return null;
        return fares.reduce((min, curr) => (curr.totalPrice < min.totalPrice ? curr : min), fares[0]).priceId;
    }

    private static buildDisplayLegs(groups: Map<number, any[]>): MulticityDisplayLeg[] {
        return Array.from(groups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([legIndex, legSegments]) => ({
                legIndex,
                segmentIds: legSegments.map((seg: any) => seg?.id),
                flightKey: this.getFlightKey(legSegments),
                from: legSegments[0]?.da?.code || '',
                to: legSegments[legSegments.length - 1]?.aa?.code || ''
            }));
    }

    static groupSegmentsIntoLegs(
        segments: any[],
        targetDestinations: string[]
    ): Map<number, any[]> {
        const legs: Map<number, any[]> = new Map();
        const hasTargets = targetDestinations.length > 0;
        let currentLeg = 0;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!legs.has(currentLeg)) {
                legs.set(currentLeg, []);
            }
            legs.get(currentLeg)!.push(segment);

            const nextSegment = segments[i + 1];
            if (!nextSegment) break;

            if (hasTargets && currentLeg >= targetDestinations.length - 1) continue;

            const destCodes = [segment.aa?.code, segment.aa?.cityCode].filter(Boolean);
            const currentTargetDest = targetDestinations[currentLeg];
            const isLegEndByDest = !!currentTargetDest && destCodes.includes(currentTargetDest);

            let isLegEndByDiscontinuity = false;
            const nextOrigCode = nextSegment.da?.code || nextSegment.da?.cityCode;
            if (destCodes[0] !== nextOrigCode) {
                isLegEndByDiscontinuity = true;
            } else if (segment.at && nextSegment.dt) {
                const arrTime = new Date(segment.at).getTime();
                const depTime = new Date(nextSegment.dt).getTime();
                if (depTime - arrTime > 24 * 60 * 60 * 1000) {
                    isLegEndByDiscontinuity = true;
                }
            }

            if (isLegEndByDest || isLegEndByDiscontinuity) {
                currentLeg++;
            }
        }

        return legs;
    }

    private static isCoherentLeg(legSegments: any[]): boolean {
        for (let i = 0; i < legSegments.length - 1; i++) {
            const current = legSegments[i];
            const next = legSegments[i + 1];

            const arrivalCode = current.aa?.code || current.aa?.cityCode;
            const departureCode = next.da?.code || next.da?.cityCode;
            if (arrivalCode !== departureCode) return false;

            if (current.at && next.dt) {
                if (new Date(next.dt).getTime() < new Date(current.at).getTime()) return false;
            }
        }
        return true;
    }

    private static isCoherentItinerary(legs: Map<number, any[]>): boolean {
        for (const legSegments of legs.values()) {
            if (!this.isCoherentLeg(legSegments)) return false;
        }
        return true;
    }

    private static diagnoseGrouping(legs: Map<number, any[]>, routeCount: number): string[] {
        const diagnostics: string[] = [];

        if (routeCount && legs.size !== routeCount) {
            diagnostics.push(`LEG_COUNT_MISMATCH:expected=${routeCount},actual=${legs.size}`);
        }
        if (!this.isCoherentItinerary(legs)) {
            diagnostics.push("LEG_SEQUENCE_INCOHERENT");
        }

        return diagnostics;
    }

    private static normalizeComboStructure(comboFlights: any[], routes: MulticityRoute[]) {
        const targetDestinations = routes.map((route) => route.to).filter(Boolean);
        const result: any[] = [];
        const options: MulticityOption[] = [];
        const unmappable: MulticityRejection[] = [];

        comboFlights.forEach((combo: any, sourceIndex: number) => {
            const segments = combo.sI || [];
            const fares = this.extractOptionFares(combo.totalPriceList);

            if (!segments.length || !fares.length) {
                const reason = !segments.length ? "NO_SEGMENTS" : "NO_PRICE_IDS";
                unmappable.push({ sourceType: "TRIPJACK_COMBO", sourceIndex, reason });
                logFlightEvent("NORMALIZATION_REJECTED", {
                    searchType: "MULTICITY",
                    mode: "INTERNATIONAL",
                    sourceIndex,
                    reason
                });
                return;
            }

            const legs = this.groupSegmentsIntoLegs(segments, targetDestinations);
            const diagnostics = this.diagnoseGrouping(legs, routes.length);
            const optionId = `C-${sourceIndex}`;
            const priceIds = fares.map((fare) => fare.priceId);
            const defaultPriceId = this.cheapestPriceId(fares);

            options.push({
                optionId,
                sourceType: "TRIPJACK_COMBO",
                sourceIndex,
                routeIndex: null,
                fares,
                priceIds,
                defaultPriceId,
                legs: this.buildDisplayLegs(legs),
                diagnostics
            });

            if (diagnostics.length) {
                logFlightEvent("OPTION_CREATED_WITH_DIAGNOSTICS", {
                    searchType: "MULTICITY",
                    mode: "INTERNATIONAL",
                    optionId,
                    sourceIndex,
                    segmentIds: segments.map((seg: any) => seg?.id),
                    diagnostics
                });
            }

            const itinerary: any = {
                optionId,
                sourceType: "TRIPJACK_COMBO",
                sourceIndex,
                priceIds,
                priceId: defaultPriceId,
                diagnostics,
                itineraryKey: this.getFlightKey(segments),
                totalPrice: this.getCheapestFare(combo.totalPriceList)?.fd?.ADULT?.fC?.TF || 0,
                legs: []
            };

            legs.forEach((legSegments, legIndex) => {
                const legFlight = this.mapSegmentsToLeg(legSegments, combo.totalPriceList, legIndex);
                itinerary.legs.push({ ...legFlight, optionId });
            });

            result.push(itinerary);
        });

        logFlightEvent("NORMALIZATION_RESULT", {
            searchType: "MULTICITY",
            mode: "INTERNATIONAL",
            supplierInventory: comboFlights.length,
            optionsCreated: options.length,
            unmappable: unmappable.length,
            withDiagnostics: options.filter((option) => option.diagnostics.length).length
        });

        const airlineMap: Record<string, { name: string; code: string; count: number }> = {};

        result.forEach((itinerary: any) => {
            itinerary.legs?.forEach((leg: any) => {
                if (!leg?.airline) return;

                const airlineName = leg.airline;
                const airlineCode = leg.airlineCode || '';

                if (!airlineMap[airlineName]) {
                    airlineMap[airlineName] = {
                        name: airlineName,
                        code: airlineCode,
                        count: 0
                    };
                }
                airlineMap[airlineName].count += 1;
            });
        });

        const airlineStats = Object.values(airlineMap)
            .map(({ name, code, count }) => ({
                airline: name,
                airlineCode: code,
                flights: count
            }))
            .sort((a, b) => b.flights - a.flights);

        const selection: MulticitySelectionIndex = {
            mode: "INTERNATIONAL",
            selectionMode: "COMBINED",
            routes,
            options,
            unmappable
        };

        return {
            flights: result,
            airlineStats,
            selection
        };
    }

    private static normalizeDomesticStructure(tripInfos: AnyObj, routes: MulticityRoute[]) {
        const legKeys = Object.keys(tripInfos)
            .filter(key => !isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b));

        const options: MulticityOption[] = [];
        const unmappable: MulticityRejection[] = [];

        const legs = legKeys.map((key) => {
            const routeIndex = Number(key);
            const flights = tripInfos[key] || [];
            return this.mapLegToFlights(routeIndex, flights, options, unmappable);
        });

        const allFlights = legs.flatMap((leg: any) => leg.flights);

        logFlightEvent("NORMALIZATION_RESULT", {
            searchType: "MULTICITY",
            mode: "DOMESTIC",
            routeCount: legKeys.length,
            supplierInventory: legKeys.reduce((sum, key) => sum + (tripInfos[key]?.length || 0), 0),
            optionsCreated: options.length,
            unmappable: unmappable.length
        });

        const selection: MulticitySelectionIndex = {
            mode: "DOMESTIC",
            selectionMode: "PER_ROUTE",
            routes: routes.length ? routes : legKeys.map((key) => ({
                routeIndex: Number(key),
                from: '',
                to: '',
                travelDate: ''
            })),
            options,
            unmappable
        };

        return {
            flights: legs,
            airlineStats: this.buildAirlineStats(allFlights),
            selection
        };
    }

    private static transformDomesticWithAllFares(tripInfos: AnyObj) {
        const legKeys = Object.keys(tripInfos)
            .filter(key => !isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b));

        const legs = legKeys.map((key) => {
            const flights = tripInfos[key] || [];
            return this.mapLegToFlightsWithAllFares(Number(key), flights);
        });

        return {
            flights: legs,
            type: 'domestic'
        };
    }

    private static transformComboWithAllFares(comboFlights: any[], routes: MulticityRoute[]) {
        const result: any[] = [];
        const targetDestinations = routes.map((route) => route.to).filter(Boolean);

        comboFlights.forEach((combo: any, sourceIndex: number) => {
            const segments = combo.sI || [];
            const optionFares = this.extractOptionFares(combo.totalPriceList);
            if (!segments.length || !optionFares.length) return;

            const legs = this.groupSegmentsIntoLegs(segments, targetDestinations);
            const diagnostics = this.diagnoseGrouping(legs, routes.length);

            const allFares = (combo.totalPriceList || []).map((fare: any) => ({
                fareName: fare.fareIdentifier || "UNKNOWN",
                totalPrice: fare.fd?.ADULT?.fC?.TF || 0,
                cabinClass: fare.fd?.ADULT?.cc || "UNKNOWN",
                fareId: fare.id,
                baseFare: fare.fd?.ADULT?.fC?.BF || 0,
                tax: fare.fd?.ADULT?.fC?.TAF || 0,
                netFare: fare.fd?.ADULT?.fC?.NF || 0
            }));

            const cheapestFare = this.getCheapestFare(combo.totalPriceList);
            const totalPrice = cheapestFare?.fd?.ADULT?.fC?.TF || 0;

            const itinerary: any = {
                optionId: `C-${sourceIndex}`,
                sourceIndex,
                priceIds: optionFares.map((fare) => fare.priceId),
                priceId: this.cheapestPriceId(optionFares),
                diagnostics,
                itineraryKey: this.getFlightKey(segments),
                totalPrice: totalPrice,
                cheapestFare: {
                    price: cheapestFare?.fd?.ADULT?.fC?.TF || 0,
                    cabinClass: cheapestFare?.fd?.ADULT?.cc || "UNKNOWN",
                    fareName: cheapestFare?.fareIdentifier || "UNKNOWN"
                },
                allFares: allFares,
                fareSummary: {
                    totalFares: allFares.length,
                    fareNames: allFares.map((f: any) => f.fareName),
                    priceRange: {
                        min: Math.min(...allFares.map((f: any) => f.totalPrice)),
                        max: Math.max(...allFares.map((f: any) => f.totalPrice))
                    }
                },
                legs: []
            };

            legs.forEach((legSegments, legIndex) => {
                const legFlight = this.mapSegmentsToLegWithAllFares(
                    legSegments,
                    combo.totalPriceList,
                    legIndex,
                    cheapestFare,
                    allFares
                );
                itinerary.legs.push(legFlight);
            });

            result.push(itinerary);
        });

        return {
            flights: result,
            type: 'international'
        };
    }

    private static mapSegmentsToLeg(segments: any[], totalPriceList: any[], legIndex: number) {
        const first = segments[0];
        const last = segments[segments.length - 1];
        const cheapestFare = this.getCheapestFare(totalPriceList || []);

        const fromDate = this.getDateParts(first.dt);
        const toDate = this.getDateParts(last.at);
        const baggageInfo = cheapestFare?.fd?.ADULT?.bI;
        const isRefundable = cheapestFare?.fd?.ADULT?.rT === 1 || cheapestFare?.fd?.ADULT?.rT === true;

        return {
            id: cheapestFare?.id || this.getFlightKey(segments),
            legIndex: legIndex,
            flightKey: this.getFlightKey(segments),
            priceId: cheapestFare?.id ?? null,
            airline: first?.fD?.aI?.name,
            airlineCode: first?.fD?.aI?.code,
            flightNumber: `${first?.fD?.aI?.code}-${first?.fD?.fN}`,
            cabinClass: cheapestFare?.fd?.ADULT?.cc || 'ECONOMY',
            isRefundable: isRefundable,
            checkInBaggage: { weight: baggageInfo?.iB || '15 Kg', unit: '' },
            cabinBaggage: { weight: baggageInfo?.cB || '7 Kg', unit: '' },
            from: {
                city: first?.da?.city,
                airportCode: first?.da?.code,
                time: this.getTime(first?.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: last?.aa?.city,
                airportCode: last?.aa?.code,
                time: this.getTime(last?.at),
                date: toDate.date,
                day: toDate.day
            },
            stops: segments.length - 1,
            duration: this.formatDuration(
                segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
            ),
            price: cheapestFare?.fd?.ADULT?.fC?.TF ?? 0
        };
    }

    private static mapSegmentsToLegWithAllFares(
        segments: any[],
        totalPriceList: any[],
        legIndex: number,
        cheapestFare: any,
        allFares: any[]
    ) {
        const first = segments[0];
        const last = segments[segments.length - 1];

        const fromDate = this.getDateParts(first.dt);
        const toDate = this.getDateParts(last.at);

        const flightData: any = {
            legIndex: legIndex,
            flightKey: this.getFlightKey(segments),
            airline: first?.fD?.aI?.name,
            airlineCode: first?.fD?.aI?.code,
            flightNumber: `${first?.fD?.aI?.code}-${first?.fD?.fN}`,
            from: {
                city: first?.da?.city,
                airportCode: first?.da?.code,
                airportName: first?.da?.name,
                terminal: first?.da?.terminal,
                time: this.getTime(first?.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: last?.aa?.city,
                airportCode: last?.aa?.code,
                airportName: last?.aa?.name,
                terminal: last?.aa?.terminal,
                time: this.getTime(last?.at),
                date: toDate.date,
                day: toDate.day
            },
            stops: segments.length - 1,
            duration: this.formatDuration(
                segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
            ),
            cheapestFare: {
                price: cheapestFare?.fd?.ADULT?.fC?.TF || 0,
                cabinClass: cheapestFare?.fd?.ADULT?.cc || "UNKNOWN",
                fareName: cheapestFare?.fareIdentifier || "UNKNOWN"
            },
            allFares: allFares,
            price: cheapestFare?.fd?.ADULT?.fC?.TF ?? 0
        };

        if (cheapestFare?.fd?.ADULT?.fC?.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
            flightData.original_price = cheapestFare.fd.ADULT.fC.originalTF;
            flightData.markup = cheapestFare.fd.ADULT.fC.markup;
        }

        return flightData;
    }

    private static mapLegToFlights(
        routeIndex: number,
        flights: any[],
        options: MulticityOption[],
        unmappable: MulticityRejection[]
    ) {
        const mapped: any[] = [];

        flights.forEach((flight: AnyObj, sourceIndex: number) => {
            const segments = flight.sI || [];
            const fares = this.extractOptionFares(flight.totalPriceList);

            if (!segments.length || !fares.length) {
                const reason = !segments.length ? "NO_SEGMENTS" : "NO_PRICE_IDS";
                unmappable.push({ sourceType: "TRIPJACK_ROUTE", sourceIndex, reason });
                logFlightEvent("NORMALIZATION_REJECTED", {
                    searchType: "MULTICITY",
                    mode: "DOMESTIC",
                    routeIndex,
                    sourceIndex,
                    reason
                });
                return;
            }

            const optionId = `R${routeIndex}-${sourceIndex}`;
            const first = segments[0];
            const last = segments[segments.length - 1];
            const cheapestFare = this.getCheapestFare(flight.totalPriceList || []);
            const priceIds = fares.map((fare) => fare.priceId);
            const defaultPriceId = this.cheapestPriceId(fares);

            options.push({
                optionId,
                sourceType: "TRIPJACK_ROUTE",
                sourceIndex,
                routeIndex,
                fares,
                priceIds,
                defaultPriceId,
                legs: [{
                    legIndex: routeIndex,
                    segmentIds: segments.map((seg: any) => seg?.id),
                    flightKey: this.getFlightKey(segments),
                    from: first?.da?.code || '',
                    to: last?.aa?.code || ''
                }],
                diagnostics: []
            });

            const fromDate = this.getDateParts(first.dt);
            const toDate = this.getDateParts(last.at);
            const baggageInfo = cheapestFare?.fd?.ADULT?.bI;
            const isRefundable = cheapestFare?.fd?.ADULT?.rT === 1 || cheapestFare?.fd?.ADULT?.rT === true;

            mapped.push({
                id: cheapestFare?.id || this.getFlightKey(segments),
                optionId,
                sourceType: "TRIPJACK_ROUTE",
                sourceIndex,
                routeIndex,
                legIndex: routeIndex,
                priceIds,
                priceId: defaultPriceId,
                flightKey: this.getFlightKey(segments),
                airline: first?.fD?.aI?.name,
                airlineCode: first?.fD?.aI?.code,
                flightNumber: `${first?.fD?.aI?.code}-${first?.fD?.fN}`,
                cabinClass: cheapestFare?.fd?.ADULT?.cc || 'ECONOMY',
                isRefundable: isRefundable,
                checkInBaggage: { weight: baggageInfo?.iB || '15 Kg', unit: '' },
                cabinBaggage: { weight: baggageInfo?.cB || '7 Kg', unit: '' },
                from: {
                    city: first?.da?.city,
                    airportCode: first?.da?.code,
                    time: this.getTime(first?.dt),
                    date: fromDate.date,
                    day: fromDate.day
                },
                to: {
                    city: last?.aa?.city,
                    airportCode: last?.aa?.code,
                    time: this.getTime(last?.at),
                    date: toDate.date,
                    day: toDate.day
                },
                stops: Math.max(segments.length - 1, 0),
                duration: this.formatDuration(
                    segments.reduce(
                        (sum: number, seg: any) => sum + (seg.duration || 0),
                        0
                    )
                ),
                price: cheapestFare?.fd?.ADULT?.fC?.TF ?? 0
            });
        });

        return {
            legIndex: routeIndex,
            flights: mapped
        };
    }

    private static mapLegToFlightsWithAllFares(legIndex: number, flights: any[]) {
        return {
            legIndex: legIndex,
            flights: flights.map((flight: AnyObj) => {
                const segments = flight.sI || [];
                const first = segments[0];
                const last = segments[segments.length - 1];
                const cheapestFare = this.getCheapestFare(flight.totalPriceList || []);

                const fromDate = this.getDateParts(first.dt);
                const toDate = this.getDateParts(last.at);

                const allFares = (flight.totalPriceList || []).map((fare: any) => ({
                    fareName: fare.fareIdentifier || "UNKNOWN",
                    totalPrice: fare.fd?.ADULT?.fC?.TF || 0,
                    cabinClass: fare.fd?.ADULT?.cc || "UNKNOWN",
                    fareId: fare.id,
                    baseFare: fare.fd?.ADULT?.fC?.BF || 0,
                    tax: fare.fd?.ADULT?.fC?.TAF || 0,
                    netFare: fare.fd?.ADULT?.fC?.NF || 0
                }));

                const flightData: any = {
                    flightKey: this.getFlightKey(segments),
                    airline: first?.fD?.aI?.name,
                    airlineCode: first?.fD?.aI?.code,
                    flightNumber: `${first?.fD?.aI?.code}-${first?.fD?.fN}`,
                    from: {
                        city: first?.da?.city,
                        airportCode: first?.da?.code,
                        airportName: first?.da?.name,
                        terminal: first?.da?.terminal,
                        time: this.getTime(first?.dt),
                        date: fromDate.date,
                        day: fromDate.day
                    },
                    to: {
                        city: last?.aa?.city,
                        airportCode: last?.aa?.code,
                        airportName: last?.aa?.name,
                        terminal: last?.aa?.terminal,
                        time: this.getTime(last?.at),
                        date: toDate.date,
                        day: toDate.day
                    },
                    stops: Math.max(segments.length - 1, 0),
                    duration: this.formatDuration(
                        segments.reduce(
                            (sum: number, seg: any) => sum + (seg.duration || 0),
                            0
                        )
                    ),
                    cheapestFare: {
                        price: cheapestFare?.fd?.ADULT?.fC?.TF || 0,
                        cabinClass: cheapestFare?.fd?.ADULT?.cc || "UNKNOWN",
                        fareName: cheapestFare?.fareIdentifier || "UNKNOWN"
                    },
                    allFares: allFares,
                    fareSummary: {
                        totalFares: allFares.length,
                        fareNames: allFares.map((f: any) => f.fareName),
                        priceRange: {
                            min: Math.min(...allFares.map((f: any) => f.totalPrice)),
                            max: Math.max(...allFares.map((f: any) => f.totalPrice))
                        }
                    }
                };

                if (cheapestFare?.fd?.ADULT?.fC?.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
                    flightData.original_price = cheapestFare.fd.ADULT.fC.originalTF;
                    flightData.markup = cheapestFare.fd.ADULT.fC.markup;
                }

                return flightData;
            })
        };
    }

    private static buildAirlineStats(flights: any[]) {
        const airlineMap: Record<string, { name: string; code: string; count: number }> = {};

        flights.forEach((flight: any) => {
            if (!flight?.airline) return;

            const airlineName = flight.airline;
            const airlineCode = flight.airlineCode || '';

            if (!airlineMap[airlineName]) {
                airlineMap[airlineName] = {
                    name: airlineName,
                    code: airlineCode,
                    count: 0
                };
            }
            airlineMap[airlineName].count += 1;
        });

        return Object.values(airlineMap)
            .map(({ name, code, count }) => ({
                airline: name,
                airlineCode: code,
                flights: count
            }))
            .sort((a, b) => b.flights - a.flights);
    }
}
