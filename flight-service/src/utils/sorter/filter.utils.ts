import { Filter, FilterStats } from "../../types/filter.types";
import { Flight } from "../../types/sort.types";

export class FlightFilter {

    /**
     * Apply multiple filters to flights
     */
    static applyFilters(flights: Flight[], filters: Filter[]): Flight[] {
        if (!filters || filters.length === 0) {
            return [...flights];
        }

        return flights.filter(flight => {
            return filters.every(filter => this.applyFilter(flight, filter));
        });
    }

    /**
     * Apply a single filter
     */
    private static applyFilter(flight: Flight, filter: Filter): boolean {
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
    private static filterByAirline(flight: Flight, airlines: string[]): boolean {
        if (!airlines || airlines.length === 0) return true;
        return airlines.includes(flight.airline);
    }

    /**
     * Filter by cabin class
     */
    private static filterByCabinClass(flight: Flight, cabinClasses: string[]): boolean {
        if (!cabinClasses || cabinClasses.length === 0) return true;
        return cabinClasses.includes(flight.cabinClass);
    }

    /**
     * Filter by number of stops
     */
    private static filterByStops(flight: Flight, stops: number[]): boolean {
        if (!stops || stops.length === 0) return true;
        return stops.includes(flight.stops);
    }

    /**
     * Filter by price range
     */
    private static filterByPriceRange(flight: Flight, min: number, max: number): boolean {
        return flight.price >= min && flight.price <= max;
    }

    /**
     * Filter by departure time range
     */
    private static filterByDepartureTimeRange(flight: Flight, start: string, end: string): boolean {
        const flightTime = this.timeToMinutes(flight.from.time);
        const startTime = this.timeToMinutes(start);
        const endTime = this.timeToMinutes(end);

        if (startTime <= endTime) {
            return flightTime >= startTime && flightTime <= endTime;
        } else {
            return flightTime >= startTime || flightTime <= endTime;
        }
    }

    /**
     * Filter by arrival time range
     */
    private static filterByArrivalTimeRange(flight: Flight, start: string, end: string): boolean {
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
    private static filterByDurationRange(flight: Flight, min: number, max: number): boolean {
        const durationMinutes = this.durationToMinutes(flight.duration);
        return durationMinutes >= min && durationMinutes <= max;
    }

    /**
     * Get filter statistics from flights
     */
    static getFilterStats(flights: Flight[]): FilterStats {
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

        return stats;
    }

    /**
     * Validate filter configuration
     */
    static validateFilters(filters: Filter[]): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        filters.forEach(filter => {
            switch (filter.type) {
                case 'priceRange':
                    if (filter.min < 0) errors.push('Price minimum cannot be negative');
                    if (filter.max < filter.min) errors.push('Price maximum must be greater than minimum');
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
                    if (filter.max < filter.min) errors.push('Duration maximum must be greater than minimum');
                    break;
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Helper: Convert duration string to minutes
     */
    private static durationToMinutes(duration: string): number {
        const hoursMatch = duration.match(/(\d+)h/);
        const minutesMatch = duration.match(/(\d+)m/);

        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

        return (hours * 60) + minutes;
    }

    /**
     * Helper: Convert time string to minutes
     */
    private static timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return (hours * 60) + minutes;
    }

    /**
     * Helper: Validate time format (HH:MM)
     */
    private static isValidTimeFormat(time: string): boolean {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    }
}