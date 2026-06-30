export type FilterField =
    | 'airline'
    | 'cabinClass'
    | 'stops'
    | 'priceRange'
    | 'departureTimeRange'
    | 'arrivalTimeRange'
    | 'durationRange';

export interface AirlineFilter {
    type: 'airline';
    values: string[];
}

export interface CabinClassFilter {
    type: 'cabinClass';
    values: string[];
}

export interface StopsFilter {
    type: 'stops';
    values: number[];
}

export interface PriceRangeFilter {
    type: 'priceRange';
    min: number;
    max: number;
}

export interface TimeRangeFilter {
    type: 'departureTimeRange' | 'arrivalTimeRange';
    start: string;
    end: string;
}

export interface DurationRangeFilter {
    type: 'durationRange';
    min: number;
    max: number;
}

export type Filter =
    | AirlineFilter
    | CabinClassFilter
    | StopsFilter
    | PriceRangeFilter
    | TimeRangeFilter
    | DurationRangeFilter;

export interface FilterConfig {
    filters: Filter[];
    applyToLegs?: number[] | 'all';
}

export interface FilterValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface FilterStats {
    availableAirlines: string[];
    availableCabinClasses: string[];
    priceRange: { min: number; max: number };
    stopsRange: { min: number; max: number };
    durationRange: { min: number; max: number };
    totalFlights: number;
    filteredFlights: number;
}

export interface MultiCityFlight {
    flightKey: string;
    airline: string;
    airlineCode: string;
    flightNumber: string;
    cabinClass: string;
    from: {
        city: string;
        airportCode: string;
        time: string;
        date: string;
        day: string;
    };
    to: {
        city: string;
        airportCode: string;
        time: string;
        date: string;
        day: string;
    };
    duration: string;
    stops: number;
    price: number;
}

export interface MultiCityLeg {
    legIndex: number;
    flights: MultiCityFlight[];
}