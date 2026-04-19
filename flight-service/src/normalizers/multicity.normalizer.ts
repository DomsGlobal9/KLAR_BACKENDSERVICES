import { BaseFlightNormalizer } from "./baseFlight.normalizer";

type AnyObj = Record<string, any>;

export class MultiCityNormalizer extends BaseFlightNormalizer {

    static normalize(searchResult: AnyObj) {

        const tripInfos = searchResult?.searchResult?.tripInfos;
        if (!tripInfos) return [];

        const legKeys = Object.keys(tripInfos)
            .sort((a, b) => Number(a) - Number(b));

        return legKeys.map((key) => {

            const flights = tripInfos[key] || [];

            return {
                legIndex: Number(key),

                flights: flights.map((flight: AnyObj) => {

                    const segments = flight.sI || [];

                    const first = segments[0];
                    const last = segments[segments.length - 1];

                    const cheapestFare = this.getCheapestFare(
                        flight.totalPriceList || []
                    );

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
        });
    }
}