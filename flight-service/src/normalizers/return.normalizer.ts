import { BaseFlightNormalizer } from "./baseFlight.normalizer";

export class ReturnNormalizer {

    static transform(tripJackResponse: any) {
        const tripInfos = tripJackResponse?.data?.searchResult?.tripInfos;

        if (tripInfos?.ONWARD && tripInfos?.RETURN) {
            return {
                onward: tripInfos.ONWARD.map((f: any) =>
                    this.mapFlight(f.sI, f.totalPriceList, false)
                ),
                return: tripInfos.RETURN.map((f: any) =>
                    this.mapFlight(f.sI, f.totalPriceList, true)
                )
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

            return {
                roundTrips
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
}