import { Filter } from '../../types/filter.types';

export class MultiCityFilterBuilder {
    private filters: Filter[] = [];

    addAirlineFilter(airlines: string[]): this {
        if (airlines && airlines.length > 0) {
            this.filters.push({ type: 'airline', values: airlines });
        }
        return this;
    }

    addCabinClassFilter(cabinClasses: string[]): this {
        if (cabinClasses && cabinClasses.length > 0) {
            this.filters.push({ type: 'cabinClass', values: cabinClasses });
        }
        return this;
    }

    addStopsFilter(stops: number[]): this {
        if (stops && stops.length > 0) {
            this.filters.push({ type: 'stops', values: stops });
        }
        return this;
    }

    addPriceRangeFilter(min: number, max: number): this {
        if (min !== undefined && max !== undefined && min >= 0 && max >= min) {
            this.filters.push({ type: 'priceRange', min, max });
        }
        return this;
    }

    addDepartureTimeRange(start: string, end: string): this {
        if (start && end) {
            this.filters.push({ type: 'departureTimeRange', start, end });
        }
        return this;
    }

    addArrivalTimeRange(start: string, end: string): this {
        if (start && end) {
            this.filters.push({ type: 'arrivalTimeRange', start, end });
        }
        return this;
    }

    addDurationRange(min: number, max: number): this {
        if (min !== undefined && max !== undefined && min >= 0 && max >= min) {
            this.filters.push({ type: 'durationRange', min, max });
        }
        return this;
    }

    build(): Filter[] {
        return this.filters;
    }

    clear(): this {
        this.filters = [];
        return this;
    }
}