import { BaseFlightNormalizer } from "./baseFlight.normalizer";

type AnyObj = Record<string, any>;

export class MultiCityNormalizer extends BaseFlightNormalizer {

    static normalize(searchResult: AnyObj) {
        const tripInfos = searchResult?.searchResult?.tripInfos;
        if (!tripInfos) {
            return {
                flights: [],
                airlineStats: []
            };
        }

        const hasCombo = tripInfos.COMBO && Array.isArray(tripInfos.COMBO);
        const hasLegs = Object.keys(tripInfos).some(key => !isNaN(Number(key)));

        if (hasCombo && !hasLegs) {
            return this.normalizeComboStructure(tripInfos.COMBO);
        }

        return this.normalizeDomesticStructure(tripInfos);
    }

    private static normalizeDomesticStructure(tripInfos: AnyObj) {
        const legKeys = Object.keys(tripInfos)
            .filter(key => !isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b));

        const legs = legKeys.map((key) => {
            const flights = tripInfos[key] || [];
            return this.mapLegToFlights(Number(key), flights);
        });

        const allFlights = legs.flatMap((leg: any) => leg.flights);

        return {
            flights: legs,
            airlineStats: this.buildAirlineStats(allFlights)
        };
    }

    private static normalizeComboStructure(comboFlights: any[]) {
        const result: any[] = [];

        comboFlights.forEach((combo: any) => {
            const segments = combo.sI || [];
            const legs: Map<number, any[]> = new Map();

            let currentLeg = 0;

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (!legs.has(currentLeg)) {
                    legs.set(currentLeg, []);
                }
                legs.get(currentLeg)!.push(segment);

                if (segment.isRs === true) {
                    currentLeg++;
                }
            }

            const itinerary: any = {
                itineraryKey: this.getFlightKey(segments),
                totalPrice: this.getCheapestFare(combo.totalPriceList)?.fd?.ADULT?.fC?.TF || 0,
                legs: []
            };

            legs.forEach((legSegments, legIndex) => {
                const legFlight = this.mapSegmentsToLeg(legSegments, combo.totalPriceList, legIndex);
                itinerary.legs.push(legFlight);
            });

            result.push(itinerary);
        });

        const airlineMap: Record<string, number> = {};

        result.forEach((itinerary: any) => {
            itinerary.legs?.forEach((leg: any) => {
                if (!leg?.airline) return;

                airlineMap[leg.airline] =
                    (airlineMap[leg.airline] || 0) + 1;
            });
        });

        const airlineStats = Object.entries(airlineMap)
            .map(([airline, flights]) => ({
                airline,
                flights
            }))
            .sort((a, b) => b.flights - a.flights);

        return {
            flights: result,
            airlineStats
        };
    }

    private static mapSegmentsToLeg(segments: any[], totalPriceList: any[], legIndex: number) {
        const first = segments[0];
        const last = segments[segments.length - 1];
        const cheapestFare = this.getCheapestFare(totalPriceList || []);

        const fromDate = this.getDateParts(first.dt);
        const toDate = this.getDateParts(last.at);

        return {
            legIndex: legIndex,
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
            stops: segments.length - 1,
            duration: this.formatDuration(
                segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)
            ),
            price: cheapestFare?.fd?.ADULT?.fC?.TF ?? 0
        };
    }

    private static mapLegToFlights(legIndex: number, flights: any[]) {
        return {
            legIndex: legIndex,
            flights: flights.map((flight: AnyObj) => {
                const segments = flight.sI || [];
                const first = segments[0];
                const last = segments[segments.length - 1];
                const cheapestFare = this.getCheapestFare(flight.totalPriceList || []);

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