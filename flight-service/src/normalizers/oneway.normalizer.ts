import { BaseFlightNormalizer } from "./baseFlight.normalizer";
import { envConfig } from "../config/env.config";

export class OneWayNormalizer {

    private static getStopDetails(segments: any[]): { 
        count: number; 
        stopNames: string[]; 
        stopCodes: string[];
        stopCities: string[];
        displayString: string;
    } {
        if (segments.length <= 1) {
            return {
                count: 0,
                stopNames: [],
                stopCodes: [],
                stopCities: [],
                displayString: 'Non-stop'
            };
        }

        const stops = segments.slice(0, -1);
        
        const stopNames = stops.map(seg => seg.aa?.name || seg.da?.name || "Unknown");
        const stopCodes = stops.map(seg => seg.aa?.code || seg.da?.code || "Unknown");
        const stopCities = stops.map(seg => seg.aa?.city || seg.da?.city || "Unknown");

        const count = segments.length - 1;
        const displayString = count > 0 
            ? `${count} stop${count > 1 ? 's' : ''} (${stopCities.join(' → ')})`
            : 'Non-stop';

        return {
            count,
            stopNames,
            stopCodes,
            stopCities,
            displayString
        };
    }

    static transform(tripJackResponse: any) {

        const flights = tripJackResponse?.data?.searchResult?.tripInfos?.ONWARD || [];

        const airlineMap: Record<string, { name: string; code: string; count: number }> = {};

        const normalizedFlights = flights.map((flight: any) => {

            const segments = flight.sI;

            const first = segments[0];
            const last = segments[segments.length - 1];

            const airlineName = first.fD.aI.name;
            const airlineCode = first.fD.aI.code;

            if (!airlineMap[airlineName]) {
                airlineMap[airlineName] = { 
                    name: airlineName, 
                    code: airlineCode, 
                    count: 0 
                };
            }
            airlineMap[airlineName].count += 1;

            const cheapest = BaseFlightNormalizer.getCheapestFare(
                flight.totalPriceList
            );

            const fromDate = BaseFlightNormalizer.getDateParts(first.dt);
            const toDate = BaseFlightNormalizer.getDateParts(last.at);

            const stopInfo = this.getStopDetails(segments);

            const flightData: any = {
                flightKey: BaseFlightNormalizer.getFlightKey(segments),

                airline: airlineName,
                airlineCode: airlineCode,
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
                    segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
                ),

                stops: stopInfo.count,
                stopDetails: {
                    count: stopInfo.count,
                    stopNames: stopInfo.stopNames,
                    stopCodes: stopInfo.stopCodes,
                    stopCities: stopInfo.stopCities,
                    displayString: stopInfo.displayString
                },

                price: cheapest.fd.ADULT.fC.TF,
            };

            if (cheapest.fd.ADULT.fC.originalTF && envConfig.PLATFORM_MARKUP.ENABLED) {
                flightData.original_price = cheapest.fd.ADULT.fC.originalTF;
                flightData.markup = cheapest.fd.ADULT.fC.markup;
            }

            return flightData;
        });

        const airlineStats = Object.values(airlineMap)
            .map(({ name, code, count }) => ({
                airline: name,
                airlineCode: code,
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

            const stopInfo = this.getStopDetails(segments);

            const allFares = (flight.totalPriceList || []).map((fare: any) => ({
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
                
                stops: stopInfo.count,
                stopDetails: {
                    count: stopInfo.count,
                    stopNames: stopInfo.stopNames,
                    stopCodes: stopInfo.stopCodes,
                    stopCities: stopInfo.stopCities,
                    displayString: stopInfo.displayString
                },


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
        });
    }

}