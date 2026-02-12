export type StopType = 'NON_STOP' | 'ONE_STOP' | 'TWO_PLUS_STOPS';
export type RefundType = 'REFUNDABLE' | 'NON_REFUNDABLE' | 'HOLD_AVAILABLE';
export type ArrivalTimeSlot = 'BEFORE_6AM' | '6AM_TO_12PM' | '12PM_TO_6PM' | 'AFTER_6PM';

export interface PriceRange {
    min: number;
    max: number;
}

export interface FlightFilters {
    stops?: StopType[];
    refundType?: RefundType[];
    priceRange?: PriceRange;
    arrivalTime?: ArrivalTimeSlot[];
    airlines?: string[]; 
    cabinClass?: string[]; 
}

export interface FilterOptions {
    filters: FlightFilters;
}

export interface FilterResult<T> {
    filteredData: T[];
    appliedFilters: FlightFilters;
    stats: {
        totalBeforeFilter: number;
        totalAfterFilter: number;
        priceRange: {
            min: number;
            max: number;
        };
        availableStops: StopType[];
        availableRefundTypes: RefundType[];
    };
}

export interface FilterPreset {
    id: string;
    name: string;
    filters: FlightFilters;
}