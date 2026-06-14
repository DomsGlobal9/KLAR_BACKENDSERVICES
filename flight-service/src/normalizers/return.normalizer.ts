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
            stops: segments.length - 1
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
            stops: segments.length - 1
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