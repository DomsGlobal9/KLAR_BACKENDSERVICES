import { Filter, FilterStats } from '../../types/filter.types';
import { FlightSegment } from '../../types/returnFilter.types';

export class FlightFilter {

    /**
     * Apply filters to return flights (onward and return arrays)
     */
    static applyFiltersToReturnFlights(
        flights: { onward: FlightSegment[]; return: FlightSegment[] },
        filters: Filter[],
        applyTo: 'onward' | 'return' | 'both' = 'both'
    ): { onward: FlightSegment[]; return: FlightSegment[] } {

        if (!filters || filters.length === 0) {
            return {
                onward: [...flights.onward],
                return: [...flights.return]
            };
        }

        const result = {
            onward: [...flights.onward],
            return: [...flights.return]
        };

        if (applyTo === 'onward' || applyTo === 'both') {
            result.onward = this.applyFilters(result.onward, filters);
        }

        if (applyTo === 'return' || applyTo === 'both') {
            result.return = this.applyFilters(result.return, filters);
        }

        return result;
    }

    /**
     * Apply filters to a single array of flights
     */
    static applyFilters(flights: FlightSegment[], filters: Filter[]): FlightSegment[] {
        if (!filters || filters.length === 0) {
            return [...flights];
        }

        return flights.filter(flight => {
            return filters.every(filter => this.applyFilter(flight, filter));
        });
    }

    /**
     * Apply a single filter to a flight
     */
    private static applyFilter(flight: FlightSegment, filter: Filter): boolean {
        switch (filter.type) {
            case 'airline':
                return this.filterByAirline(flight, filter.values);
            case 'cabinClass':
                return this.filterByCabinClass(flight, filter.values);
            case 'stops':
                return this.filterByStops(flight, filter.values);
            case 'priceRange':
                return this.filterByPriceRange(flight, filter.min, filter.max);
            case 'departureTimeRange':
                return this.filterByDepartureTimeRange(flight, filter.start, filter.end);
            case 'arrivalTimeRange':
                return this.filterByArrivalTimeRange(flight, filter.start, filter.end);
            case 'durationRange':
                return this.filterByDurationRange(flight, filter.min, filter.max);
            default:
                return true;
        }
    }

    /**
     * Filter by airline (include only selected airlines)
     */
    private static filterByAirline(flight: FlightSegment, airlines: string[]): boolean {
        if (!airlines || airlines.length === 0) return true;
        return airlines.includes(flight.airline);
    }

    /**
     * Filter by cabin class
     */
    private static filterByCabinClass(flight: FlightSegment, cabinClasses: string[]): boolean {
        if (!cabinClasses || cabinClasses.length === 0) return true;
        return cabinClasses.includes(flight.cabinClass);
    }

    /**
     * Filter by number of stops
     */
    private static filterByStops(flight: FlightSegment, stops: number[]): boolean {
        if (!stops || stops.length === 0) return true;

        return stops.some(stop => {
            if (stop === 2) {
                return flight.stops >= 2;
            }

            return flight.stops === stop;
        });
    }

    /**
     * Filter by price range
     */
    private static filterByPriceRange(flight: FlightSegment, min: number, max: number): boolean {
        return flight.price >= min && flight.price <= max;
    }

    /**
     * Filter by departure time range
     */
    private static filterByDepartureTimeRange(flight: FlightSegment, start: string, end: string): boolean {
        const flightTime = this.timeToMinutes(flight.from.time);
        const startTime = this.timeToMinutes(start);
        const endTime = this.timeToMinutes(end);

        const isNextDay = this.isNextDay(flight.from.date, flight.to.date);
        const isMultiDay = this.isMultiDay(flight.from.date, flight.to.date);

        if (isNextDay || isMultiDay) {
            if (startTime <= endTime) {
                return flightTime >= startTime && flightTime <= endTime;
            } else {
                return flightTime >= startTime || flightTime <= endTime;
            }
        }

        if (startTime <= endTime) {
            return flightTime >= startTime && flightTime <= endTime;
        } else {
            return flightTime >= startTime || flightTime <= endTime;
        }
    }

    /**
     * Filter by arrival time range
     */
    private static filterByArrivalTimeRange(flight: FlightSegment, start: string, end: string): boolean {
        const flightTime = this.timeToMinutes(flight.to.time);
        const startTime = this.timeToMinutes(start);
        const endTime = this.timeToMinutes(end);

        const isNextDay = this.isNextDay(flight.from.date, flight.to.date);
        const isMultiDay = this.isMultiDay(flight.from.date, flight.to.date);

        if (isNextDay || isMultiDay) {
            if (startTime <= endTime) {
                return flightTime >= startTime && flightTime <= endTime;
            } else {
                return flightTime >= startTime || flightTime <= endTime;
            }
        }

        if (startTime <= endTime) {
            return flightTime >= startTime && flightTime <= endTime;
        } else {
            return flightTime >= startTime || flightTime <= endTime;
        }
    }

    /**
     * Filter by duration range (in minutes)
     */
    private static filterByDurationRange(flight: FlightSegment, min: number, max: number): boolean {
        const durationMinutes = this.durationToMinutes(flight.duration);
        return durationMinutes >= min && durationMinutes <= max;
    }

    /**
     * Get filter statistics from flights
     */
    static getFilterStats(flights: FlightSegment[]): FilterStats {
        const stats: FilterStats = {
            availableAirlines: [],
            availableCabinClasses: [],
            priceRange: { min: Infinity, max: -Infinity },
            stopsRange: { min: Infinity, max: -Infinity },
            durationRange: { min: Infinity, max: -Infinity },
            totalFlights: flights.length,
            filteredFlights: flights.length
        };

        const airlines = new Set<string>();
        const cabinClasses = new Set<string>();

        flights.forEach(flight => {
            // Collect airlines
            airlines.add(flight.airline);

            // Collect cabin classes
            cabinClasses.add(flight.cabinClass);

            // Update price range
            stats.priceRange.min = Math.min(stats.priceRange.min, flight.price);
            stats.priceRange.max = Math.max(stats.priceRange.max, flight.price);

            // Update stops range
            stats.stopsRange.min = Math.min(stats.stopsRange.min, flight.stops);
            stats.stopsRange.max = Math.max(stats.stopsRange.max, flight.stops);

            // Update duration range
            const duration = this.durationToMinutes(flight.duration);
            stats.durationRange.min = Math.min(stats.durationRange.min, duration);
            stats.durationRange.max = Math.max(stats.durationRange.max, duration);
        });

        stats.availableAirlines = Array.from(airlines).sort();
        stats.availableCabinClasses = Array.from(cabinClasses).sort();

        // Reset min/max if no flights
        if (flights.length === 0) {
            stats.priceRange = { min: 0, max: 0 };
            stats.stopsRange = { min: 0, max: 0 };
            stats.durationRange = { min: 0, max: 0 };
        }

        return stats;
    }

    /**
     * Validate filters
     */
    static validateFilters(filters: Filter[]): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        filters.forEach(filter => {
            switch (filter.type) {
                case 'priceRange':
                    if (filter.min < 0) errors.push('Price minimum cannot be negative');
                    if (filter.max < filter.min) errors.push('Price maximum must be greater than or equal to minimum');
                    break;

                case 'departureTimeRange':
                case 'arrivalTimeRange':
                    if (!this.isValidTimeFormat(filter.start)) {
                        errors.push(`Invalid time format for ${filter.type}.start: ${filter.start}. Use HH:MM format`);
                    }
                    if (!this.isValidTimeFormat(filter.end)) {
                        errors.push(`Invalid time format for ${filter.type}.end: ${filter.end}. Use HH:MM format`);
                    }
                    break;

                case 'durationRange':
                    if (filter.min < 0) errors.push('Duration minimum cannot be negative');
                    if (filter.max < filter.min) errors.push('Duration maximum must be greater than or equal to minimum');
                    break;

                case 'stops':
                    if (filter.values.some(stop => stop < 0)) {
                        errors.push('Stop count cannot be negative');
                    }
                    break;

                case 'airline':
                    if (!filter.values || filter.values.length === 0) {
                        errors.push('Airlines filter must have at least one value');
                    }
                    break;

                case 'cabinClass':
                    if (!filter.values || filter.values.length === 0) {
                        errors.push('Cabin class filter must have at least one value');
                    }
                    break;
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert duration string "2h 30m" to total minutes
     */
    private static durationToMinutes(duration: string): number {
        const hoursMatch = duration.match(/(\d+)h/);
        const minutesMatch = duration.match(/(\d+)m/);

        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

        return (hours * 60) + minutes;
    }

    /**
     * Convert time string "HH:MM" to minutes since midnight
     */
    private static timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return (hours * 60) + minutes;
    }

    /**
     * Validate time format (HH:MM)
     */
    private static isValidTimeFormat(time: string): boolean {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    }

    /**
     * Helper: Check if flight arrives next day
     */
    private static isNextDay(fromDate: string, toDate: string): boolean {
        try {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const diffTime = to.getTime() - from.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays === 1;
        } catch {
            return fromDate !== toDate;
        }
    }

    /**
     * Helper: Check if flight arrives after multiple days
     */
    private static isMultiDay(fromDate: string, toDate: string): boolean {
        try {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const diffTime = to.getTime() - from.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 1;
        } catch {
            return false;
        }
    }
}