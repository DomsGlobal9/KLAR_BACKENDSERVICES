import { BaseFlightNormalizer } from "./baseFlight.normalizer";

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