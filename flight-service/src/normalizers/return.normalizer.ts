import { BaseFlightNormalizer } from "./baseFlight.normalizer";

export class ReturnNormalizer {

    static transform(tripJackResponse: any) {

        const tripInfos = tripJackResponse?.data?.searchResult?.tripInfos;

        /**
         * Domestic
         */
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

        /**
         * International COMBO
         */
        if (tripInfos?.COMBO) {

            const onward: any[] = [];
            const returnFlights: any[] = [];

            tripInfos.COMBO.forEach((combo: any) => {

                const onwardSegments = combo.sI.filter((seg: any) => !seg.isRs);

                const returnSegments = combo.sI.filter((seg: any) => seg.isRs);

                onward.push(
                    this.mapFlight(
                        onwardSegments,
                        combo.totalPriceList,
                        false
                    )
                );

                returnFlights.push(
                    this.mapFlight(
                        returnSegments,
                        combo.totalPriceList,
                        true
                    )
                );
            });

            return {
                onward,
                return: returnFlights
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
}