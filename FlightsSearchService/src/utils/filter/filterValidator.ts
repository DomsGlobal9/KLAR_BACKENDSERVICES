import {
    FlightFilters,
    StopType,
    RefundType,
    ArrivalTimeSlot
} from "../../interface/flight/filter.interface";

export class FilterValidator {
  static validateFilters(query: any) {
    const filters: any = {};

    // Stops filter
    if (query.stops) {
      const stopsParam = Array.isArray(query.stops) ? query.stops : [query.stops];
      filters.stops = stopsParam;
    }

    // Refund type filter
    if (query.refundType) {
      const refundParam = Array.isArray(query.refundType) ? query.refundType : [query.refundType];
      filters.refundType = refundParam;
    }

    // Price range
    if (query.minPrice || query.maxPrice) {
      filters.priceRange = {
        min: query.minPrice ? parseFloat(query.minPrice) : undefined,
        max: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
      };
    }

    // Arrival time
    if (query.arrivalTime) {
      const arrivalParam = Array.isArray(query.arrivalTime) ? query.arrivalTime : [query.arrivalTime];
      filters.arrivalTime = arrivalParam;
    }

    return filters;
  }

  static isEmpty(filters: any): boolean {
    return Object.keys(filters).length === 0;
  }
}