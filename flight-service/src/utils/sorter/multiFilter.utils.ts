import { Filter, FilterStats } from '../../types/filter.types';
import { MultiCityFlight, MultiCityLeg } from '../../types/multiFilter.types';

export class MultiCityFlightFilter {

    /**
     * Apply filters to multi-city flights
     */
    static applyFiltersToMultiCityFlights(
        flights: MultiCityLeg[],
        filters: Filter[],
        applyToLegs: number[] | 'all' = 'all'
    ): MultiCityLeg[] {

        if (!filters || filters.length === 0) {
            return flights.map(leg => ({
                ...leg,
                flights: [...leg.flights]
            }));
        }

        const result = flights.map(leg => ({
            ...leg,
            flights: [...leg.flights]
        }));

        if (applyToLegs === 'all') {
            // Apply filters to all legs
            return result.map(leg => ({
                ...leg,
                flights: this.applyFilters(leg.flights, filters)
            }));
        } else {
            // Apply filters to specific legs only
            return result.map(leg => {
                if (applyToLegs.includes(leg.legIndex)) {
                    return {
                        ...leg,
                        flights: this.applyFilters(leg.flights, filters)
                    };
                }
                return leg;
            });
        }
    }

    /**
     * Apply filters to a single array of flights
     */
    static applyFilters(flights: MultiCityFlight[], filters: Filter[]): MultiCityFlight[] {
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
    private static applyFilter(flight: MultiCityFlight, filter: Filter): boolean {
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
     * Filter by airline
     */
    private static filterByAirline(flight: MultiCityFlight, airlines: string[]): boolean {
        if (!airlines || airlines.length === 0) return true;
        return airlines.includes(flight.airline);
    }

    /**
     * Filter by cabin class
     */
    private static filterByCabinClass(flight: MultiCityFlight, cabinClasses: string[]): boolean {
        if (!cabinClasses || cabinClasses.length === 0) return true;
        return cabinClasses.includes(flight.cabinClass);
    }

    /**
     * Filter by number of stops
     */
    private static filterByStops(
        flight: MultiCityFlight,
        stops: number[]
    ): boolean {

        if (!stops || stops.length === 0) return true;

        return stops.some(stop => {

            // 0 stop -> exact
            if (stop === 0) {
                return flight.stops === 0;
            }

            // 1 stop -> exact
            if (stop === 1) {
                return flight.stops === 1;
            }

            // 2 stop -> 2 or more
            if (stop === 2) {
                return flight.stops >= 2;
            }

            return false;
        });
    }

    /**
     * Filter by price range
     */
    private static filterByPriceRange(flight: MultiCityFlight, min: number, max: number): boolean {
        return flight.price >= min && flight.price <= max;
    }

    /**
     * Filter by departure time range
     */
    private static filterByDepartureTimeRange(flight: MultiCityFlight, start: string, end: string): boolean {
        const flightTime = this.timeToMinutes(flight.from.time);
        const startTime = this.timeToMinutes(start);
        const endTime = this.timeToMinutes(end);

        // Handle overnight ranges
        if (startTime <= endTime) {
            return flightTime >= startTime && flightTime <= endTime;
        } else {
            return flightTime >= startTime || flightTime <= endTime;
        }
    }

    /**
     * Filter by arrival time range
     */
    private static filterByArrivalTimeRange(flight: MultiCityFlight, start: string, end: string): boolean {
        const flightTime = this.timeToMinutes(flight.to.time);
        const startTime = this.timeToMinutes(start);
        const endTime = this.timeToMinutes(end);

        if (startTime <= endTime) {
            return flightTime >= startTime && flightTime <= endTime;
        } else {
            return flightTime >= startTime || flightTime <= endTime;
        }
    }

    /**
     * Filter by duration range (in minutes)
     */
    private static filterByDurationRange(flight: MultiCityFlight, min: number, max: number): boolean {
        const durationMinutes = this.durationToMinutes(flight.duration);
        return durationMinutes >= min && durationMinutes <= max;
    }

    /**
     * Get filter statistics from multi-city flights
     */
    static getMultiCityFilterStats(flights: MultiCityLeg[]): { [key: number]: FilterStats } {
        const stats: { [key: number]: FilterStats } = {};

        flights.forEach(leg => {
            stats[leg.legIndex] = this.getFilterStats(leg.flights);
        });

        return stats;
    }

    /**
     * Get filter statistics from flights array
     */
    static getFilterStats(flights: MultiCityFlight[]): FilterStats {
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
            airlines.add(flight.airline);
            cabinClasses.add(flight.cabinClass);

            stats.priceRange.min = Math.min(stats.priceRange.min, flight.price);
            stats.priceRange.max = Math.max(stats.priceRange.max, flight.price);

            stats.stopsRange.min = Math.min(stats.stopsRange.min, flight.stops);
            stats.stopsRange.max = Math.max(stats.stopsRange.max, flight.stops);

            const duration = this.durationToMinutes(flight.duration);
            stats.durationRange.min = Math.min(stats.durationRange.min, duration);
            stats.durationRange.max = Math.max(stats.durationRange.max, duration);
        });

        stats.availableAirlines = Array.from(airlines).sort();
        stats.availableCabinClasses = Array.from(cabinClasses).sort();

        // Reset if no flights
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
    static validateFilters(filters: Filter[]): FilterValidationResult {
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
     * Convert duration string to minutes
     */
    private static durationToMinutes(duration: string): number {
        const hoursMatch = duration.match(/(\d+)h/);
        const minutesMatch = duration.match(/(\d+)m/);

        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

        return (hours * 60) + minutes;
    }

    /**
     * Convert time string to minutes
     */
    private static timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return (hours * 60) + minutes;
    }

    /**
     * Validate time format
     */
    private static isValidTimeFormat(time: string): boolean {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    }
}

interface FilterValidationResult {
    isValid: boolean;
    errors: string[];
}