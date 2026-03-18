import {
    FlightFilters,
    StopType,
    RefundType,
    ArrivalTimeSlot
} from "../../interface/flight/filter.interface";

export class FilterValidator {
    static validateFilters(query: any): FlightFilters {
        const filters: FlightFilters = {};


        if (query.stops) {
            const stops = Array.isArray(query.stops) ? query.stops : [query.stops];
            const validStops: StopType[] = ['NON_STOP', 'ONE_STOP', 'TWO_PLUS_STOPS'];
            filters.stops = stops.filter((s: string) => validStops.includes(s as StopType)) as StopType[];
        }


        if (query.refundType) {
            const refundTypes = Array.isArray(query.refundType) ? query.refundType : [query.refundType];
            const validRefundTypes: RefundType[] = ['REFUNDABLE', 'NON_REFUNDABLE', 'HOLD_AVAILABLE'];
            filters.refundType = refundTypes.filter((r: string) => validRefundTypes.includes(r as RefundType)) as RefundType[];
        }


        if (query.minPrice !== undefined && query.maxPrice !== undefined) {
            const min = parseFloat(query.minPrice);
            const max = parseFloat(query.maxPrice);
            if (!isNaN(min) && !isNaN(max) && min >= 0 && max >= min) {
                filters.priceRange = { min, max };
            }
        }


        if (query.arrivalTime) {
            const arrivalTimes = Array.isArray(query.arrivalTime) ? query.arrivalTime : [query.arrivalTime];
            const validTimes: ArrivalTimeSlot[] = ['BEFORE_6AM', '6AM_TO_12PM', '12PM_TO_6PM', 'AFTER_6PM'];
            filters.arrivalTime = arrivalTimes.filter((t: string) => validTimes.includes(t as ArrivalTimeSlot)) as ArrivalTimeSlot[];
        }


        if (query.airlines) {
            filters.airlines = Array.isArray(query.airlines) ? query.airlines : [query.airlines];
        }

        return filters;
    }

    static getDefaultFilters(): FlightFilters {
        return {};
    }

    static isEmpty(filters: FlightFilters): boolean {
        return !filters.stops?.length &&
            !filters.refundType?.length &&
            !filters.priceRange &&
            !filters.arrivalTime?.length &&
            !filters.airlines?.length;
    }
}