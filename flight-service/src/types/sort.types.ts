export type SortField =
    | 'price'
    | 'duration'
    | 'departureTime'
    | 'arrivalTime'
    | 'stops'
    | 'airline';

export type SortOrder = 'asc' | 'desc';

export interface SortOption {
    field: SortField;
    order: SortOrder;
}

export interface SortConfig {
    sortBy: SortOption;
}

export interface Flight {
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