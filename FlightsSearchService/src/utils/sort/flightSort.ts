import { TransformedFlight } from "../../interface/flight/flight.interface";

type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';
type PrimarySort = 'CHEAPEST' | 'QUICKEST';
type SecondarySort = 'EARLY_DEPARTURE' | 'EARLY_ARRIVAL' | 'NONE';

export interface SortOptions {
    primary: PrimarySort;
    secondary: SecondarySort;
}

export function sortFlights(flightData: any, tripType: TripType, options: SortOptions): any {
    if (!flightData) return flightData;

    switch (tripType) {
        case 'ONE_WAY':
            return sortOneWay(flightData, options);
        case 'RETURN':
            return sortReturn(flightData, options);
        case 'MULTI_CITY':
            return sortMultiCity(flightData, options);
        default:
            return flightData;
    }
}

function sortOneWay(flights: TransformedFlight[], options: SortOptions): TransformedFlight[] {
    return [...flights].sort((a, b) => {

        let primary = 0;
        if (options.primary === 'CHEAPEST') {
            const aFare = Math.min(...a.fareOptions.map(f => f.totalFare));
            const bFare = Math.min(...b.fareOptions.map(f => f.totalFare));
            primary = aFare - bFare;
        } else {
            primary = a.duration - b.duration;
        }


        if (primary === 0 && options.secondary !== 'NONE') {
            if (options.secondary === 'EARLY_DEPARTURE') {
                return new Date(a.departure.datetime || a.departure.time).getTime() -
                    new Date(b.departure.datetime || b.departure.time).getTime();
            }
            if (options.secondary === 'EARLY_ARRIVAL') {
                return new Date(a.arrival.datetime || a.arrival.time).getTime() -
                    new Date(b.arrival.datetime || b.arrival.time).getTime();
            }
        }

        return primary;
    });
}

function sortReturn(combinations: any[], options: SortOptions): any[] {
    return [...combinations].sort((a, b) => {
        let primary = 0;
        if (options.primary === 'CHEAPEST') {
            primary = a.totalFare - b.totalFare;
        } else {
            const aDuration = a.onward.duration + a.return.duration;
            const bDuration = b.onward.duration + b.return.duration;
            primary = aDuration - bDuration;
        }


        if (primary === 0 && options.secondary !== 'NONE') {
            if (options.secondary === 'EARLY_DEPARTURE') {
                return new Date(a.onward.departure.datetime || a.onward.departure.time).getTime() -
                    new Date(b.onward.departure.datetime || b.onward.departure.time).getTime();
            }
            if (options.secondary === 'EARLY_ARRIVAL') {
                return new Date(a.return.arrival.datetime || a.return.arrival.time).getTime() -
                    new Date(b.return.arrival.datetime || b.return.arrival.time).getTime();
            }
        }

        return primary;
    });
}

function sortMultiCity(legs: any[], options: SortOptions): any[] {
    return legs.map(leg => ({
        ...leg,
        flights: sortOneWay(leg.flights, options)
    }));
}

export function validateSortOptions(query: any): SortOptions {
    const primary = query?.primary === 'QUICKEST' ? 'QUICKEST' : 'CHEAPEST';

    let secondary: SecondarySort = 'NONE';
    if (query?.secondary === 'EARLY_DEPARTURE') secondary = 'EARLY_DEPARTURE';
    if (query?.secondary === 'EARLY_ARRIVAL') secondary = 'EARLY_ARRIVAL';

    return { primary, secondary };
}