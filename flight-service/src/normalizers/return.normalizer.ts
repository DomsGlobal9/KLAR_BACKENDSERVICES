import { BaseFlightNormalizer } from "./baseFlight.normalizer";

export class ReturnNormalizer {

    static transform(tripJackResponse: any) {

        const onward = tripJackResponse?.data?.searchResult?.tripInfos?.ONWARD || [];
        const returnFlights = tripJackResponse?.data?.searchResult?.tripInfos?.RETURN || [];

        const mapFlight = (flight: any, isReturn = false) => {

            const segments = flight.sI;
            const first = segments[0];
            const last = segments[segments.length - 1];

            const cheapest = BaseFlightNormalizer.getCheapestFare(flight.totalPriceList);

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
                    segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
                ),

                stops: segments.length - 1,

                price: cheapest.fd.ADULT.fC.TF
            };
        };

        return {
            onward: onward.map((f: any) => mapFlight(f, false)),
            return: returnFlights.map((f: any) => mapFlight(f, true))
        };
    }
}