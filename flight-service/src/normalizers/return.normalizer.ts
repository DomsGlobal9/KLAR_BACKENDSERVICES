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

    /**
     * Transform with all fares (for PDF generation)
     * This method includes all fare options for each flight
     */
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

        // Extract stops information
        const stopsInfo = this.extractStops(segments);

        return {
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
            stopDetails: stopsInfo, // Add stop details
            price: cheapest.fd.ADULT.fC.TF
        };
    }

    /**
     * Map flight with all fares (for PDF generation)
     */
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

        // Extract stops information
        const stopsInfo = this.extractStops(segments);

        const allFares = (totalPriceList || []).map((fare: any) => ({
            fareName: fare.fareIdentifier || "UNKNOWN",
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
            stopDetails: stopsInfo, // Add stop details
            cheapestFare: {
                price: cheapest?.fd?.ADULT?.fC?.TF || 0,
                cabinClass: cheapest?.fd?.ADULT?.cc || "UNKNOWN",
                fareName: cheapest?.fareIdentifier || "UNKNOWN"
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

        // Extract stops information
        const stopsInfo = this.extractStops(segments);

        return {
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
            stopDetails: stopsInfo // Add stop details
        };
    }

    /**
     * Map flight for combo with all fares (for PDF generation)
     */
    private static mapFlightWithAllFaresForCombo(
        segments: any[],
        totalPriceList: any[],
        isReturn = false
    ) {
        if (!segments || segments.length === 0) return null;

        const first = segments[0];
        const last = segments[segments.length - 1];

        const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
        const toDate = BaseFlightNormalizer.getDateParts(last.at);

        // Extract stops information
        const stopsInfo = this.extractStops(segments);

        return {
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
            stopDetails: stopsInfo // Add stop details
        };
    }

    private static buildAirlineStats(flights: any[]) {
        const airlineMap: Record<string, number> = {};

        flights.forEach((flight: any) => {
            if (!flight?.airline) return;

            airlineMap[flight.airline] =
                (airlineMap[flight.airline] || 0) + 1;
        });

        return Object.entries(airlineMap)
            .map(([airline, flights]) => ({
                airline,
                flights
            }))
            .sort((a, b) => b.flights - a.flights);
    }

    /**
     * Extract stops information from flight segments
     * @param segments - Array of flight segments
     * @returns Stops information including city names and airport codes
     */
    static extractStops(segments: any[]): any {
        // If no segments or only one segment (direct flight)
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

        // Loop through segments to find stops
        // For each segment except the last one, check if it's a stop
        for (let i = 0; i < segments.length - 1; i++) {
            const currentSegment = segments[i];
            const nextSegment = segments[i + 1];

            // The arrival airport of the current segment is where we stop
            const stopAirport = currentSegment.aa || currentSegment.da;

            // Get stop city information
            const stopInfo = {
                city: stopAirport?.city || 'Unknown City',
                airportCode: stopAirport?.code || 'Unknown',
                airportName: stopAirport?.name || '',
                terminal: stopAirport?.terminal || '',
                // Calculate stopover duration (time between arrival and next departure)
                stopoverDuration: this.calculateStopoverDuration(
                    currentSegment.at,
                    nextSegment.dt
                ),
                // Arrival and departure times at the stop
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

        // Build display string
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

    /**
     * Calculate the duration of a stopover
     * @param arrivalTime - Arrival time string (ISO format)
     * @param departureTime - Departure time string (ISO format)
     * @returns Formatted stopover duration string
     */
    static calculateStopoverDuration(arrivalTime: string, departureTime: string): string {
        if (!arrivalTime || !departureTime) {
            return '0h 0m';
        }

        try {
            const arrival = new Date(arrivalTime);
            const departure = new Date(departureTime);
            const diffMinutes = Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60));

            if (diffMinutes < 0) {
                // If negative, it means the stop crosses midnight or next day
                // Add 24 hours (1440 minutes) to get the actual duration
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










// import { BaseFlightNormalizer } from "./baseFlight.normalizer";

// export class ReturnNormalizer {

//     static transform(tripJackResponse: any) {
//         const tripInfos = tripJackResponse?.data?.searchResult?.tripInfos;

//         if (tripInfos?.ONWARD && tripInfos?.RETURN) {

//             const onward = tripInfos.ONWARD.map((f: any) =>
//                 this.mapFlight(f.sI, f.totalPriceList, false)
//             );

//             const returnFlights = tripInfos.RETURN.map((f: any) =>
//                 this.mapFlight(f.sI, f.totalPriceList, true)
//             );

//             return {
//                 onward,
//                 return: returnFlights,
//                 airlineStats: this.buildAirlineStats([
//                     ...onward,
//                     ...returnFlights
//                 ])
//             };
//         }

//         if (tripInfos?.COMBO) {
//             const roundTrips = tripInfos.COMBO.map((combo: any) => {
//                 const onwardSegments = combo.sI.filter((seg: any) => !seg.isRs);
//                 const returnSegments = combo.sI.filter((seg: any) => seg.isRs);

//                 const onwardFlight = this.mapFlightForCombo(
//                     onwardSegments,
//                     combo.totalPriceList,
//                     false
//                 );

//                 const returnFlight = this.mapFlightForCombo(
//                     returnSegments,
//                     combo.totalPriceList,
//                     true
//                 );

//                 const cheapestFare = BaseFlightNormalizer.getCheapestFare(combo.totalPriceList);
//                 const totalPrice = cheapestFare?.fd?.ADULT?.fC?.TF || 0;

//                 return {
//                     onward: onwardFlight,
//                     return: returnFlight,
//                     totalPrice
//                 };
//             });

//             const allFlights = roundTrips.flatMap((rt: any) => [
//                 rt.onward,
//                 rt.return
//             ]).filter(Boolean);

//             return {
//                 roundTrips,
//                 airlineStats: this.buildAirlineStats(allFlights)
//             };
//         }

//         return {
//             onward: [],
//             return: []
//         };
//     }

//     private static mapFlight(
//         segments: any[],
//         totalPriceList: any[],
//         isReturn = false
//     ) {
//         if (!segments || segments.length === 0) return null;

//         const first = segments[0];
//         const last = segments[segments.length - 1];
//         const cheapest = BaseFlightNormalizer.getCheapestFare(totalPriceList);

//         const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
//         const toDate = BaseFlightNormalizer.getDateParts(last.at);

//         return {
//             flightKey: BaseFlightNormalizer.getFlightKey(segments),
//             isReturn,
//             airline: first.fD.aI.name,
//             airlineCode: first.fD.aI.code,
//             flightNumber: `${first.fD.aI.code}-${first.fD.fN}`,
//             cabinClass: cheapest.fd.ADULT.cc,
//             from: {
//                 city: first.da.city,
//                 airportCode: first.da.code,
//                 time: BaseFlightNormalizer.getTime(first.dt),
//                 date: fromDate.date,
//                 day: fromDate.day
//             },
//             to: {
//                 city: last.aa.city,
//                 airportCode: last.aa.code,
//                 time: BaseFlightNormalizer.getTime(last.at),
//                 date: toDate.date,
//                 day: toDate.day
//             },
//             duration: BaseFlightNormalizer.formatDuration(
//                 segments.reduce(
//                     (sum: number, seg: any) => sum + (seg.duration || 0),
//                     0
//                 )
//             ),
//             stops: segments.length - 1,
//             price: cheapest.fd.ADULT.fC.TF
//         };
//     }

//     private static mapFlightForCombo(
//         segments: any[],
//         totalPriceList: any[],
//         isReturn = false
//     ) {
//         if (!segments || segments.length === 0) return null;

//         const first = segments[0];
//         const last = segments[segments.length - 1];
//         const cheapest = BaseFlightNormalizer.getCheapestFare(totalPriceList);

//         const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
//         const toDate = BaseFlightNormalizer.getDateParts(last.at);

//         return {
//             flightKey: BaseFlightNormalizer.getFlightKey(segments),
//             isReturn,
//             airline: first.fD.aI.name,
//             airlineCode: first.fD.aI.code,
//             flightNumber: `${first.fD.aI.code}-${first.fD.fN}`,
//             cabinClass: cheapest.fd.ADULT.cc,
//             from: {
//                 city: first.da.city,
//                 airportCode: first.da.code,
//                 time: BaseFlightNormalizer.getTime(first.dt),
//                 date: fromDate.date,
//                 day: fromDate.day
//             },
//             to: {
//                 city: last.aa.city,
//                 airportCode: last.aa.code,
//                 time: BaseFlightNormalizer.getTime(last.at),
//                 date: toDate.date,
//                 day: toDate.day
//             },
//             duration: BaseFlightNormalizer.formatDuration(
//                 segments.reduce(
//                     (sum: number, seg: any) => sum + (seg.duration || 0),
//                     0
//                 )
//             ),
//             stops: segments.length - 1
//         };
//     }

//     private static buildAirlineStats(flights: any[]) {
//         const airlineMap: Record<string, number> = {};

//         flights.forEach((flight: any) => {
//             if (!flight?.airline) return;

//             airlineMap[flight.airline] =
//                 (airlineMap[flight.airline] || 0) + 1;
//         });

//         return Object.entries(airlineMap)
//             .map(([airline, flights]) => ({
//                 airline,
//                 flights
//             }))
//             .sort((a, b) => b.flights - a.flights);
//     }
// }