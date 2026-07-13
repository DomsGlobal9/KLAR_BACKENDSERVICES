import { BaseFlightNormalizer } from "./baseFlight.normalizer";
import { envConfig } from "../config/env.config";

type AnyObj = Record<string, any>;

export class MultiCityNormalizer extends BaseFlightNormalizer {

    static normalize(searchResult: AnyObj, payload?: any) {
        const tripInfos = searchResult?.searchResult?.tripInfos;
        if (!tripInfos) {
            return {
                flights: [],
                airlineStats: []
            };
        }

        const hasCombo = tripInfos.COMBO && Array.isArray(tripInfos.COMBO);
        const hasLegs = Object.keys(tripInfos).some(key => !isNaN(Number(key)));

        if (hasCombo && !hasLegs) {
            return this.normalizeComboStructure(tripInfos.COMBO, payload);
        }

        return this.normalizeDomesticStructure(tripInfos);
    }

    /**
     * Transform with all fares (for PDF generation)
     * Includes all fare options for each flight
     */
    static transformWithAllFares(searchResult: AnyObj, payload?: any) {
        const tripInfos = searchResult?.searchResult?.tripInfos;
        if (!tripInfos) {
            return {
                flights: [],
                type: 'none'
            };
        }

        const hasCombo = tripInfos.COMBO && Array.isArray(tripInfos.COMBO);
        const hasLegs = Object.keys(tripInfos).some(key => !isNaN(Number(key)));

        if (hasCombo && !hasLegs) {
            return this.transformComboWithAllFares(tripInfos.COMBO, payload);
        }

        return this.transformDomesticWithAllFares(tripInfos);
    }

    private static normalizeDomesticStructure(tripInfos: AnyObj) {
        const legKeys = Object.keys(tripInfos)
            .filter(key => !isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b));

        const legs = legKeys.map((key) => {
            const flights = tripInfos[key] || [];
            return this.mapLegToFlights(Number(key), flights);
        });

        const allFlights = legs.flatMap((leg: any) => leg.flights);

        return {
            flights: legs,
            airlineStats: this.buildAirlineStats(allFlights)
        };
    }

    /**
     * Transform domestic multicity with all fares
     */
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

    private static normalizeComboStructure(comboFlights: any[], payload?: any) {
        const result: any[] = [];

        comboFlights.forEach((combo: any) => {
            const segments = combo.sI || [];
            const legs = this.splitSegmentsIntoLegs(segments, payload);

            const itinerary: any = {
                itineraryKey: this.getFlightKey(segments),
                totalPrice: this.getCheapestFare(combo.totalPriceList)?.fd?.ADULT?.fC?.TF || 0,
                segments: []
            };

            legs.forEach((legSegments, legIndex) => {
                const legFlight = this.mapSegmentsToLeg(legSegments, combo.totalPriceList, legIndex);
                itinerary.segments.push(legFlight);
            });

            result.push(itinerary);
        });

        // Build airline stats with airline code
        const airlineMap: Record<string, { name: string; code: string; count: number }> = {};

        result.forEach((itinerary: any) => {
            itinerary.segments?.forEach((leg: any) => {
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

        return {
            flights: result,
            airlineStats
        };
    }

    /**
     * Transform international multicity (combo) with all fares
     */
    private static transformComboWithAllFares(comboFlights: any[], payload?: any) {
        const result: any[] = [];

        comboFlights.forEach((combo: any) => {
            const segments = combo.sI || [];
            const legs = this.splitSegmentsIntoLegs(segments, payload);


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
                segments: []
            };

            legs.forEach((legSegments, legIndex) => {
                const legFlight = this.mapSegmentsToLegWithAllFares(
                    legSegments,
                    combo.totalPriceList,
                    legIndex,
                    cheapestFare,
                    allFares
                );
                itinerary.segments.push(legFlight);
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

        return {
            legIndex: legIndex,
            flightKey: this.getFlightKey(segments),
            airline: first?.fD?.aI?.name,
            airlineCode: first?.fD?.aI?.code,
            flightNumber: `${first?.fD?.aI?.code}-${first?.fD?.fN}`,
            cabinClass: cheapestFare?.fd?.ADULT?.cc,
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
            durationMinutes: segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0),
            price: cheapestFare?.fd?.ADULT?.fC?.TF ?? 0,
            origin: first?.da?.code,
            destination: last?.aa?.code,
            departureTime: first?.dt,
            arrivalTime: last?.at
        };
    }

    /**
     * Map segments to leg with all fares (for PDF)
     */
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
            durationMinutes: segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0),
            origin: first?.da?.code,
            destination: last?.aa?.code,
            departureTime: first?.dt,
            arrivalTime: last?.at,
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

    private static mapLegToFlights(legIndex: number, flights: any[]) {
        return {
            legIndex: legIndex,
            flights: flights.map((flight: AnyObj) => {
                const segments = flight.sI || [];
                const first = segments[0];
                const last = segments[segments.length - 1];
                const cheapestFare = this.getCheapestFare(flight.totalPriceList || []);

                const fromDate = this.getDateParts(first.dt);
                const toDate = this.getDateParts(last.at);

                return {
                    flightKey: this.getFlightKey(segments),
                    airline: first?.fD?.aI?.name,
                    airlineCode: first?.fD?.aI?.code,
                    flightNumber: `${first?.fD?.aI?.code}-${first?.fD?.fN}`,
                    cabinClass: cheapestFare?.fd?.ADULT?.cc,
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
                };
            })
        };
    }

    /**
     * Map leg to flights with all fares (for PDF)
     */
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

    private static splitSegmentsIntoLegs(segments: any[], payload?: any): Map<number, any[]> {
        const legs: Map<number, any[]> = new Map();
        let currentLeg = 0;

        const routeInfos = payload?.routeInfos;
        const targetDestinations = Array.isArray(routeInfos)
            ? routeInfos.map((r: any) => r.toCityOrAirport?.code?.toUpperCase()).filter(Boolean)
            : [];

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!legs.has(currentLeg)) {
                legs.set(currentLeg, []);
            }
            legs.get(currentLeg)!.push(segment);

            if (targetDestinations.length > 0) {
                const segmentDest = segment.aa?.code?.toUpperCase();
                const targetDest = targetDestinations[currentLeg];

                if (segmentDest === targetDest && currentLeg < targetDestinations.length - 1) {
                    currentLeg++;
                }
            } else {
                if (segment.isRs === true) {
                    currentLeg++;
                }
            }
        }
        return legs;
    }
}