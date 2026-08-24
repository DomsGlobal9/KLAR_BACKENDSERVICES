import { BaseFlightNormalizer } from "./baseFlight.normalizer";
import { envConfig } from "../config/env.config";

export class ReturnNormalizer {

    static transform(tripJackResponse: any) {
        const tripInfos = tripJackResponse?.data?.searchResult?.tripInfos;

        if (tripInfos?.ONWARD && tripInfos?.RETURN) {
            const onward = tripInfos.ONWARD.map((f: any) =>
                this.mapFlight(f.sI, f.totalPriceList, false)
            );

            const returnFlights = tripInfos.RETURN.map((f: any) =>
                this.mapFlight(f.sI, f.totalPriceList, true)
            );

            return {
                onward,
                return: returnFlights,
                airlineStats: this.buildAirlineStats([
                    ...onward,
                    ...returnFlights
                ])
            };
        }

        if (tripInfos?.COMBO) {
            const roundTrips = tripInfos.COMBO.map((combo: any) => {
                const onwardSegments = combo.sI.filter((seg: any) => !seg.isRs);
                const returnSegments = combo.sI.filter((seg: any) => seg.isRs);

                const onwardFlight = this.mapFlightForCombo(
                    onwardSegments,
                    combo.totalPriceList,
                    false
                );

                const returnFlight = this.mapFlightForCombo(
                    returnSegments,
                    combo.totalPriceList,
                    true
                );

                const cheapestFare = BaseFlightNormalizer.getCheapestFare(combo.totalPriceList);
                const totalPrice = cheapestFare?.fd?.ADULT?.fC?.TF || 0;

                return {
                    onward: onwardFlight,
                    return: returnFlight,
                    totalPrice
                };
            });

            const allFlights = roundTrips.flatMap((rt: any) => [
                rt.onward,
                rt.return
            ]).filter(Boolean);

            return {
                roundTrips,
                airlineStats: this.buildAirlineStats(allFlights)
            };
        }

        return {
            onward: [],
            return: []
        };
    }

    static transformWithAllFares(tripJackResponse: any) {
        const tripInfos = tripJackResponse?.data?.searchResult?.tripInfos;

        if (tripInfos?.ONWARD && tripInfos?.RETURN) {
            const onward = tripInfos.ONWARD.map((f: any) =>
                this.mapFlightWithAllFares(f.sI, f.totalPriceList, false)
            ).filter(Boolean);

            const returnFlights = tripInfos.RETURN.map((f: any) =>
                this.mapFlightWithAllFares(f.sI, f.totalPriceList, true)
            ).filter(Boolean);

            return {
                onward,
                return: returnFlights,
                type: 'domestic'
            };
        }

        if (tripInfos?.COMBO) {
            const roundTrips = tripInfos.COMBO.map((combo: any) => {
                const onwardSegments = combo.sI.filter((seg: any) => !seg.isRs);
                const returnSegments = combo.sI.filter((seg: any) => seg.isRs);

                const onwardFlight = this.mapFlightWithAllFaresForCombo(
                    onwardSegments,
                    combo.totalPriceList,
                    false
                );

                const returnFlight = this.mapFlightWithAllFaresForCombo(
                    returnSegments,
                    combo.totalPriceList,
                    true
                );

                const allFares = (combo.totalPriceList || []).map((fare: any) => ({
                    fareName: fare.fareIdentifier || "UNKNOWN",
                    fareType: fare.ft || fare.pft || fare.fareIdentifier || "REGULAR",
                    ft: fare.ft || fare.pft || "REGULAR",
                    totalPrice: fare.fd?.ADULT?.fC?.TF || 0,
                    cabinClass: fare.fd?.ADULT?.cc || "UNKNOWN",
                    fareId: fare.id,
                    baseFare: fare.fd?.ADULT?.fC?.BF || 0,
                    tax: fare.fd?.ADULT?.fC?.TAF || 0,
                    netFare: fare.fd?.ADULT?.fC?.NF || 0
                }));

                const cheapestFare = BaseFlightNormalizer.getCheapestFare(combo.totalPriceList);
                const totalPrice = cheapestFare?.fd?.ADULT?.fC?.TF || 0;

                return {
                    onward: onwardFlight,
                    return: returnFlight,
                    totalPrice,
                    cheapestFare: {
                        price: cheapestFare?.fd?.ADULT?.fC?.TF || 0,
                        cabinClass: cheapestFare?.fd?.ADULT?.cc || "UNKNOWN",
                        fareName: cheapestFare?.fareIdentifier || "UNKNOWN",
                        fareType: cheapestFare?.ft || cheapestFare?.pft || cheapestFare?.fareIdentifier || "REGULAR",
                        ft: cheapestFare?.ft || cheapestFare?.pft || "REGULAR"
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
            });

            return {
                roundTrips,
                type: 'international'
            };
        }

        return {
            onward: [],
            return: [],
            type: 'none'
        };
    }

    private static mapFlight(
        segments: any[],
        totalPriceList: any[],
        isReturn = false
    ) {
        if (!segments || segments.length === 0) return null;

        const first = segments[0];
        const last = segments[segments.length - 1];
        const cheapest = BaseFlightNormalizer.getCheapestFare(totalPriceList);

        const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
        const toDate = BaseFlightNormalizer.getDateParts(last.at);

        const stopsInfo = this.extractStops(segments);

        const flightData: any = {
            flightKey: BaseFlightNormalizer.getFlightKey(segments),
            isReturn,
            airline: first.fD.aI.name,
            airlineCode: first.fD.aI.code,
            flightNumber: `${first.fD.aI.code}-${first.fD.fN}`,
            cabinClass: cheapest.fd.ADULT.cc,
            fareType: cheapest?.ft || cheapest?.pft || cheapest?.fareIdentifier || "REGULAR",
            ft: cheapest?.ft || cheapest?.pft || "REGULAR",
            from: {
                city: first.da.city,
                airportCode: first.da.code,
                time: BaseFlightNormalizer.getTime(first.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: last.aa.city,
                airportCode: last.aa.code,
                time: BaseFlightNormalizer.getTime(last.at),
                date: toDate.date,
                day: toDate.day
            },
            duration: BaseFlightNormalizer.formatDuration(
                segments.reduce(
                    (sum: number, seg: any) => sum + (seg.duration || 0),
                    0
                )
            ),
            stops: segments.length - 1,
            stopDetails: stopsInfo,
            price: cheapest.fd.ADULT.fC.TF
        };

        if (cheapest?.fd?.ADULT?.fC?.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
            flightData.original_price = cheapest.fd.ADULT.fC.originalTF;
            flightData.markup = cheapest.fd.ADULT.fC.markup;
        }

        return flightData;
    }

    private static mapFlightWithAllFares(
        segments: any[],
        totalPriceList: any[],
        isReturn = false
    ) {
        if (!segments || segments.length === 0) return null;

        const first = segments[0];
        const last = segments[segments.length - 1];
        const cheapest = BaseFlightNormalizer.getCheapestFare(totalPriceList);

        const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
        const toDate = BaseFlightNormalizer.getDateParts(last.at);

        const stopsInfo = this.extractStops(segments);

        const allFares = (totalPriceList || []).map((fare: any) => ({
            fareName: fare.fareIdentifier || "UNKNOWN",
            fareType: fare.ft || fare.pft || fare.fareIdentifier || "REGULAR",
            ft: fare.ft || fare.pft || "REGULAR",
            totalPrice: fare.fd?.ADULT?.fC?.TF || 0,
            cabinClass: fare.fd?.ADULT?.cc || "UNKNOWN",
            fareId: fare.id,
            baseFare: fare.fd?.ADULT?.fC?.BF || 0,
            tax: fare.fd?.ADULT?.fC?.TAF || 0,
            netFare: fare.fd?.ADULT?.fC?.NF || 0
        }));

        const flightData: any = {
            flightKey: BaseFlightNormalizer.getFlightKey(segments),
            isReturn,
            airline: first.fD.aI.name,
            airlineCode: first.fD.aI.code,
            flightNumber: `${first.fD.aI.code}-${first.fD.fN}`,
            from: {
                city: first.da.city,
                airportCode: first.da.code,
                airportName: first.da.name,
                terminal: first.da.terminal,
                time: BaseFlightNormalizer.getTime(first.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: last.aa.city,
                airportCode: last.aa.code,
                airportName: last.aa.name,
                terminal: last.aa.terminal,
                time: BaseFlightNormalizer.getTime(last.at),
                date: toDate.date,
                day: toDate.day
            },
            duration: BaseFlightNormalizer.formatDuration(
                segments.reduce(
                    (sum: number, seg: any) => sum + (seg.duration || 0),
                    0
                )
            ),
            stops: segments.length - 1,
            stopDetails: stopsInfo,
            cheapestFare: {
                price: cheapest?.fd?.ADULT?.fC?.TF || 0,
                cabinClass: cheapest?.fd?.ADULT?.cc || "UNKNOWN",
                fareName: cheapest?.fareIdentifier || "UNKNOWN",
                fareType: cheapest?.ft || cheapest?.pft || cheapest?.fareIdentifier || "REGULAR",
                ft: cheapest?.ft || cheapest?.pft || "REGULAR"
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

        if (cheapest?.fd?.ADULT?.fC?.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
            flightData.original_price = cheapest.fd.ADULT.fC.originalTF;
            flightData.markup = cheapest.fd.ADULT.fC.markup;
        }

        return flightData;
    }

    private static mapFlightForCombo(
        segments: any[],
        totalPriceList: any[],
        isReturn = false
    ) {
        if (!segments || segments.length === 0) return null;

        const first = segments[0];
        const last = segments[segments.length - 1];
        const cheapest = BaseFlightNormalizer.getCheapestFare(totalPriceList);

        const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
        const toDate = BaseFlightNormalizer.getDateParts(last.at);

        const stopsInfo = this.extractStops(segments);

        const flightData: any = {
            flightKey: BaseFlightNormalizer.getFlightKey(segments),
            isReturn,
            airline: first.fD.aI.name,
            airlineCode: first.fD.aI.code,
            flightNumber: `${first.fD.aI.code}-${first.fD.fN}`,
            cabinClass: cheapest.fd.ADULT.cc,
            from: {
                city: first.da.city,
                airportCode: first.da.code,
                time: BaseFlightNormalizer.getTime(first.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: last.aa.city,
                airportCode: last.aa.code,
                time: BaseFlightNormalizer.getTime(last.at),
                date: toDate.date,
                day: toDate.day
            },
            duration: BaseFlightNormalizer.formatDuration(
                segments.reduce(
                    (sum: number, seg: any) => sum + (seg.duration || 0),
                    0
                )
            ),
            stops: segments.length - 1,
            stopDetails: stopsInfo
        };

        if (cheapest?.fd?.ADULT?.fC?.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
            flightData.original_price = cheapest.fd.ADULT.fC.originalTF;
            flightData.markup = cheapest.fd.ADULT.fC.markup;
        }

        return flightData;
    }

    private static mapFlightWithAllFaresForCombo(
        segments: any[],
        totalPriceList: any[],
        isReturn = false
    ) {
        if (!segments || segments.length === 0) return null;

        const first = segments[0];
        const last = segments[segments.length - 1];
        const cheapest = BaseFlightNormalizer.getCheapestFare(totalPriceList);

        const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
        const toDate = BaseFlightNormalizer.getDateParts(last.at);

        const stopsInfo = this.extractStops(segments);

        const flightData: any = {
            flightKey: BaseFlightNormalizer.getFlightKey(segments),
            isReturn,
            airline: first.fD.aI.name,
            airlineCode: first.fD.aI.code,
            flightNumber: `${first.fD.aI.code}-${first.fD.fN}`,
            from: {
                city: first.da.city,
                airportCode: first.da.code,
                airportName: first.da.name,
                terminal: first.da.terminal,
                time: BaseFlightNormalizer.getTime(first.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: last.aa.city,
                airportCode: last.aa.code,
                airportName: last.aa.name,
                terminal: last.aa.terminal,
                time: BaseFlightNormalizer.getTime(last.at),
                date: toDate.date,
                day: toDate.day
            },
            duration: BaseFlightNormalizer.formatDuration(
                segments.reduce(
                    (sum: number, seg: any) => sum + (seg.duration || 0),
                    0
                )
            ),
            stops: segments.length - 1,
            stopDetails: stopsInfo
        };

        if (cheapest?.fd?.ADULT?.fC?.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
            flightData.original_price = cheapest.fd.ADULT.fC.originalTF;
            flightData.markup = cheapest.fd.ADULT.fC.markup;
        }

        return flightData;
    }

    private static buildAirlineStats(flights: any[]) {
        const airlineMap: Record<string, { count: number; code: string }> = {};

        flights.forEach((flight: any) => {
            if (!flight?.airline) return;

            if (!airlineMap[flight.airline]) {
                airlineMap[flight.airline] = {
                    count: 0,
                    code: flight.airlineCode || ''
                };
            }
            airlineMap[flight.airline].count += 1;
        });

        return Object.entries(airlineMap)
            .map(([airline, data]) => ({
                airline,
                airlineCode: data.code,
                flights: data.count
            }))
            .sort((a, b) => b.flights - a.flights);
    }

    static extractStops(segments: any[]): any {
        if (!segments || segments.length <= 1) {
            return {
                count: 0,
                stopNames: [],
                stopCodes: [],
                stopCities: [],
                displayString: "Non-stop"
            };
        }

        const stops = [];
        const stopCities = [];
        const stopCodes = [];
        const stopNames = [];
        const stopoverDurations = [];

        for (let i = 0; i < segments.length - 1; i++) {
            const currentSegment = segments[i];
            const nextSegment = segments[i + 1];

            const stopAirport = currentSegment.aa || currentSegment.da;

            const stopInfo = {
                city: stopAirport?.city || 'Unknown City',
                airportCode: stopAirport?.code || 'Unknown',
                airportName: stopAirport?.name || '',
                terminal: stopAirport?.terminal || '',
                stopoverDuration: this.calculateStopoverDuration(
                    currentSegment.at,
                    nextSegment.dt
                ),
                arrivalTime: BaseFlightNormalizer.getTime(currentSegment.at),
                departureTime: BaseFlightNormalizer.getTime(nextSegment.dt),
                arrivalDate: BaseFlightNormalizer.getDateParts(currentSegment.at),
                departureDate: BaseFlightNormalizer.getDateParts(nextSegment.dt)
            };

            stops.push(stopInfo);
            stopCities.push(stopAirport?.city || 'Unknown City');
            stopCodes.push(stopAirport?.code || 'Unknown');
            stopNames.push(stopAirport?.name || 'Unknown Airport');

            if (stopInfo.stopoverDuration && stopInfo.stopoverDuration !== '0h 0m') {
                stopoverDurations.push(stopInfo.stopoverDuration);
            }
        }

        let displayString = "Non-stop";
        if (stops.length === 1) {
            displayString = `1 stop (${stopCities[0]})`;
        } else if (stops.length > 1) {
            displayString = `${stops.length} stops (${stopCities.join(', ')})`;
        }

        return {
            count: stops.length,
            stopNames: stopNames,
            stopCodes: stopCodes,
            stopCities: stopCities,
            stopoverDurations: stopoverDurations.length > 0 ? stopoverDurations : [],
            details: stops,
            displayString: displayString
        };
    }

    static calculateStopoverDuration(arrivalTime: string, departureTime: string): string {
        if (!arrivalTime || !departureTime) {
            return '0h 0m';
        }

        try {
            const arrival = new Date(arrivalTime);
            const departure = new Date(departureTime);
            const diffMinutes = Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60));

            if (diffMinutes < 0) {
                const adjustedDiff = diffMinutes + 1440;
                const hours = Math.floor(adjustedDiff / 60);
                const minutes = adjustedDiff % 60;
                return `${hours}h ${minutes}m`;
            }

            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;

            return `${hours}h ${minutes}m`;
        } catch (error) {
            return '0h 0m';
        }
    }
}