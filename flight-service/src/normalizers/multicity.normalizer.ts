import { BaseFlightNormalizer } from "./baseFlight.normalizer";

type AnyObj = Record<string, any>;

export class MultiCityNormalizer extends BaseFlightNormalizer {

    static normalize(searchResult: AnyObj) {

        const tripInfos = searchResult?.searchResult?.tripInfos;
        if (!tripInfos) return [];

        if (tripInfos.COMBO) {
            return this.normalizeComboStructure(tripInfos.COMBO);
        }

        return this.normalizeDomesticStructure(tripInfos);
    }

    private static normalizeDomesticStructure(tripInfos: AnyObj) {
        const legKeys = Object.keys(tripInfos)
            .sort((a, b) => Number(a) - Number(b));

        return legKeys.map((key) => {
            const flights = tripInfos[key] || [];
            return this.mapLegToFlights(Number(key), flights);
        });
    }

    private static normalizeComboStructure(comboFlights: any[]) {
        /**
         * Group combo flights by leg index
         * In COMBO structure, each combo contains all segments for one complete itinerary
         * We need to organize them by leg index
         */

        const legsMap: Map<number, any[]> = new Map();

        comboFlights.forEach((combo: any) => {
            combo.sI.forEach((segment: any, index: number) => {
                const legIndex = index; 
                if (!legsMap.has(legIndex)) {
                    legsMap.set(legIndex, []);
                }

                /**
                 * Check if we already have this flight for this leg
                 */
                const existingFlights = legsMap.get(legIndex)!;
                const existingFlightIndex = existingFlights.findIndex(
                    flight => flight.flightKey === BaseFlightNormalizer.getFlightKey([segment])
                );

                const mappedFlight = this.mapSegmentToFlight(segment, combo.totalPriceList, legIndex);

                if (existingFlightIndex === -1) {
                    existingFlights.push(mappedFlight);
                } else {
                    /**
                     * If flight exists, we might need to merge or update, but typically each combo 
                     * represents a unique combination so we add all
                     */
                    existingFlights.push(mappedFlight);
                }
            });
        });

        /**
         * Convert map to array format
         */
        const result: any[] = [];
        legsMap.forEach((flights, legIndex) => {
            // Remove duplicates based on flightKey
            const uniqueFlights = this.removeDuplicateFlights(flights);
            result.push({
                legIndex,
                flights: uniqueFlights
            });
        });

        /**
         * Sort by leg index
         */
        return result.sort((a, b) => a.legIndex - b.legIndex);
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

    private static mapSegmentToFlight(segment: any, totalPriceList: any[], legIndex: number) {
        /**
         * For international COMBO structure, each segment is treated as a flight/leg
         * But segments might have multiple flights? Actually in COMBO, sI contains all segments
         * For multi-city with international, each leg is a segment in the sI array
         */

        const cheapestFare = this.getCheapestFare(totalPriceList || []);
        const fromDate = this.getDateParts(segment.dt);
        const toDate = this.getDateParts(segment.at);

        // Use the segment's own fD for flight info
        const flightInfo = segment.fD || {};
        const airline = flightInfo.aI || {};

        return {
            flightKey: this.getFlightKey([segment]),
            airline: airline.name,
            airlineCode: airline.code,
            flightNumber: `${airline.code}-${flightInfo.fN}`,
            cabinClass: cheapestFare?.fd?.ADULT?.cc,
            from: {
                city: segment.da?.city,
                airportCode: segment.da?.code,
                time: this.getTime(segment.dt),
                date: fromDate.date,
                day: fromDate.day
            },
            to: {
                city: segment.aa?.city,
                airportCode: segment.aa?.code,
                time: this.getTime(segment.at),
                date: toDate.date,
                day: toDate.day
            },
            stops: segment.stops || 0,
            duration: this.formatDuration(segment.duration || 0),
            price: cheapestFare?.fd?.ADULT?.fC?.TF ?? 0
        };
    }

    private static removeDuplicateFlights(flights: any[]): any[] {
        const seen = new Set();
        return flights.filter(flight => {
            if (seen.has(flight.flightKey)) {
                return false;
            }
            seen.add(flight.flightKey);
            return true;
        });
    }
}