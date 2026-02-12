import { TransformedFlight } from "../../interface/flight/flight.interface";
import {
    FlightFilters,
    StopType,
    RefundType,
    ArrivalTimeSlot,
    FilterResult
} from "../../interface/flight/filter.interface";

type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

/**
 * Main filter function - Entry point for all filter operations
 */
export function filterFlights(
    flightData: any,
    tripType: TripType,
    filters: FlightFilters
): any {
    if (!flightData || !filters) return flightData;

    switch (tripType) {
        case 'ONE_WAY':
            return filterOneWayFlights(flightData as TransformedFlight[], filters);
        case 'RETURN':
            return filterReturnFlights(flightData as any[], filters);
        case 'MULTI_CITY':
            return filterMultiCityFlights(flightData as any[], filters);
        default:
            return flightData;
    }
}

/**
 * Filter ONE_WAY flights
 */
export function filterOneWayFlights(
    flights: TransformedFlight[],
    filters: FlightFilters
): TransformedFlight[] {
    return flights.filter(flight => {
        if (filters.stops && filters.stops.length > 0) {
            if (!matchStopsFilter(flight.stops, filters.stops)) {
                return false;
            }
        }

        
        if (filters.refundType && filters.refundType.length > 0) {
            if (!matchRefundTypeFilter(flight.fareOptions, filters.refundType)) {
                return false;
            }
        }

        
        if (filters.priceRange) {
            if (!matchPriceRangeFilter(flight.fareOptions, filters.priceRange)) {
                return false;
            }
        }

        
        if (filters.arrivalTime && filters.arrivalTime.length > 0) {
            if (!matchArrivalTimeFilter(flight.arrival.datetime || flight.arrival.time, filters.arrivalTime)) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Filter RETURN flight combinations
 */
export function filterReturnFlights(
    combinations: any[],
    filters: FlightFilters
): any[] {
    return combinations.filter(combo => {
        
        if (!filterOneWayFlights([combo.onward], filters).length) {
            return false;
        }

        
        if (!filterOneWayFlights([combo.return], filters).length) {
            return false;
        }

        return true;
    });
}

/**
 * Filter MULTI_CITY flights
 */
export function filterMultiCityFlights(
    legs: { legNumber: number; legKey: string; flights: TransformedFlight[] }[],
    filters: FlightFilters
): { legNumber: number; legKey: string; flights: TransformedFlight[] }[] {
    return legs.map(leg => ({
        ...leg,
        flights: filterOneWayFlights(leg.flights, filters)
    })).filter(leg => leg.flights.length > 0);
}

/**
 * Match stops filter
 */
function matchStopsFilter(stops: number, selectedStops: StopType[]): boolean {
    return selectedStops.some(type => {
        if (type === 'NON_STOP' && stops === 0) return true;
        if (type === 'ONE_STOP' && stops === 1) return true;
        if (type === 'TWO_PLUS_STOPS' && stops >= 2) return true;
        return false;
    });
}

/**
 * Match refund type filter
 */
function matchRefundTypeFilter(
    fareOptions: TransformedFlight['fareOptions'],
    selectedTypes: RefundType[]
): boolean {
    return fareOptions.some(fare => {
        return selectedTypes.some(type => {
            if (type === 'REFUNDABLE' && fare.refundable === true) return true;
            if (type === 'NON_REFUNDABLE' && fare.refundable === false) return true;
            if (type === 'HOLD_AVAILABLE') {
                
                const holdKeywords = ['FLEX', 'FLEXI', 'HOLD', 'PREMIUM'];
                return holdKeywords.some(keyword =>
                    fare.fareIdentifier?.toUpperCase().includes(keyword)
                );
            }
            return false;
        });
    });
}

/**
 * Match price range filter
 */
function matchPriceRangeFilter(
    fareOptions: TransformedFlight['fareOptions'],
    priceRange: { min: number; max: number }
): boolean {
    const minFare = Math.min(...fareOptions.map(f => f.totalFare));
    return minFare >= priceRange.min && minFare <= priceRange.max;
}

/**
 * Match arrival time filter
 */
function matchArrivalTimeFilter(
    arrivalDateTime: string,
    selectedSlots: ArrivalTimeSlot[]
): boolean {
    const date = new Date(arrivalDateTime);
    const hours = date.getHours();

    return selectedSlots.some(slot => {
        switch (slot) {
            case 'BEFORE_6AM':
                return hours >= 0 && hours < 6;
            case '6AM_TO_12PM':
                return hours >= 6 && hours < 12;
            case '12PM_TO_6PM':
                return hours >= 12 && hours < 18;
            case 'AFTER_6PM':
                return hours >= 18 && hours <= 23;
            default:
                return false;
        }
    });
}

/**
 * Get filter statistics for ONE_WAY flights
 */
export function getFilterStats(
    flights: TransformedFlight[]
): FilterResult<TransformedFlight>['stats'] {
    const fares = flights.flatMap(f => f.fareOptions.map(fo => fo.totalFare));
    const minPrice = Math.min(...fares);
    const maxPrice = Math.max(...fares);

    const availableStops: StopType[] = [];
    if (flights.some(f => f.stops === 0)) availableStops.push('NON_STOP');
    if (flights.some(f => f.stops === 1)) availableStops.push('ONE_STOP');
    if (flights.some(f => f.stops >= 2)) availableStops.push('TWO_PLUS_STOPS');

    const availableRefundTypes: RefundType[] = [];
    if (flights.some(f => f.fareOptions.some(fo => fo.refundable === true))) {
        availableRefundTypes.push('REFUNDABLE');
    }
    if (flights.some(f => f.fareOptions.some(fo => fo.refundable === false))) {
        availableRefundTypes.push('NON_REFUNDABLE');
    }
    if (flights.some(f => f.fareOptions.some(fo =>
        ['FLEX', 'FLEXI', 'HOLD', 'PREMIUM'].some(k =>
            fo.fareIdentifier?.toUpperCase().includes(k)
        )
    ))) {
        availableRefundTypes.push('HOLD_AVAILABLE');
    }

    return {
        totalBeforeFilter: flights.length,
        totalAfterFilter: flights.length,
        priceRange: {
            min: minPrice,
            max: maxPrice
        },
        availableStops,
        availableRefundTypes
    };
}