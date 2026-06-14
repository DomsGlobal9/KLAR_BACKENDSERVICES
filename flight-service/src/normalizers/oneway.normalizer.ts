import { BaseFlightNormalizer } from "./baseFlight.normalizer";
import { envConfig } from "../config/env.config";

export class OneWayNormalizer {

    static transform(tripJackResponse: any) {

        const flights = tripJackResponse?.data?.searchResult?.tripInfos?.ONWARD || [];

        const airlineMap: Record<string, number> = {};

        const normalizedFlights = flights.map((flight: any) => {

            const segments = flight.sI;

            const first = segments[0];
            const last = segments[segments.length - 1];

            const airlineName = first.fD.aI.name;

            // Count airlines
            airlineMap[airlineName] = (airlineMap[airlineName] || 0) + 1;

            const cheapest = BaseFlightNormalizer.getCheapestFare(
                flight.totalPriceList
            );

            const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
            const toDate = BaseFlightNormalizer.getDateParts(last.at);

            const flightData: any = {
                flightKey: BaseFlightNormalizer.getFlightKey(segments),

                airline: airlineName,
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
                    segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
                ),

                stops: segments.length - 1,

                price: cheapest.fd.ADULT.fC.TF,
            };

            if (cheapest.fd.ADULT.fC.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
                flightData.original_price = cheapest.fd.ADULT.fC.originalTF;
                flightData.markup = cheapest.fd.ADULT.fC.markup;
            }

            return flightData;
        });

        const airlineStats = Object.entries(airlineMap)
            .map(([airline, count]) => ({
                airline,
                flights: count
            }))
            .sort((a, b) => b.flights - a.flights);

        return {
            flights: normalizedFlights,
            airlineStats
        };
    }

    static transformWithAllFares(tripJackResponse: any) {
        const flights = tripJackResponse?.data?.searchResult?.tripInfos?.ONWARD || [];

        return flights.map((flight: any) => {
            const segments = flight.sI;
            const first = segments[0];
            const last = segments[segments.length - 1];

            const cheapest = BaseFlightNormalizer.getCheapestFare(flight.totalPriceList);
            const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
            const toDate = BaseFlightNormalizer.getDateParts(last.at);


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

                flightKey: BaseFlightNormalizer.getFlightKey(segments),
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
                    segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
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
        });
    }

}