import { FlightSegment } from "../../types/returnSort.types";
import { SortField, SortOption } from "../../types/sort.types";

export class ReturnFlightSorter {

    /**
     * Main sorting function for return flights
     */
    static sortReturnFlights(
        flights: { onward: FlightSegment[]; return: FlightSegment[] },
        sortOption: SortOption,
        applyTo: 'onward' | 'return' | 'both' = 'both'
    ): { onward: FlightSegment[]; return: FlightSegment[] } {
        
        const result = {
            onward: [...flights.onward],
            return: [...flights.return]
        };

        if (applyTo === 'onward' || applyTo === 'both') {
            result.onward = this.sortFlights(result.onward, sortOption);
        }

        if (applyTo === 'return' || applyTo === 'both') {
            result.return = this.sortFlights(result.return, sortOption);
        }

        return result;
    }

    /**
     * Sort a single array of flights
     */
    static sortFlights(flights: FlightSegment[], sortOption: SortOption): FlightSegment[] {
        const { field, order } = sortOption;

        return [...flights].sort((a, b) => {
            let comparison = 0;

            switch (field) {
                case 'price':
                    comparison = this.comparePrice(a, b);
                    break;
                case 'duration':
                    comparison = this.compareDuration(a, b);
                    break;
                case 'departureTime':
                    comparison = this.compareDepartureTime(a, b);
                    break;
                case 'arrivalTime':
                    comparison = this.compareArrivalTime(a, b);
                    break;
                case 'stops':
                    comparison = this.compareStops(a, b);
                    break;
                case 'airline':
                    comparison = this.compareAirline(a, b);
                    break;
                default:
                    comparison = 0;
            }

            return order === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * Compare by price
     */
    private static comparePrice(a: FlightSegment, b: FlightSegment): number {
        return a.price - b.price;
    }

    /**
     * Compare by duration
     */
    private static compareDuration(a: FlightSegment, b: FlightSegment): number {
        const minutesA = this.durationToMinutes(a.duration);
        const minutesB = this.durationToMinutes(b.duration);
        return minutesA - minutesB;
    }

    /**
     * Compare by departure time
     */
    private static compareDepartureTime(a: FlightSegment, b: FlightSegment): number {
        const timeA = this.timeToMinutes(a.from.time);
        const timeB = this.timeToMinutes(b.from.time);

        if (timeA === timeB) {
            return this.compareDates(a.from.date, b.from.date);
        }

        return timeA - timeB;
    }

    /**
     * Compare by arrival time
     */
    private static compareArrivalTime(a: FlightSegment, b: FlightSegment): number {
        const timeA = this.timeToMinutes(a.to.time);
        const timeB = this.timeToMinutes(b.to.time);

        if (timeA === timeB) {
            return this.compareDates(a.to.date, b.to.date);
        }

        return timeA - timeB;
    }

    /**
     * Compare by stops
     */
    private static compareStops(a: FlightSegment, b: FlightSegment): number {
        return a.stops - b.stops;
    }

    /**
     * Compare by airline
     */
    private static compareAirline(a: FlightSegment, b: FlightSegment): number {
        return a.airline.localeCompare(b.airline);
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
     * Compare dates in "DD-MMM-YY" format
     */
    private static compareDates(dateA: string, dateB: string): number {
        const parseDate = (dateStr: string): Date => {
            const [day, month, year] = dateStr.split('-');
            const monthMap: { [key: string]: number } = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };

            const fullYear = 2000 + parseInt(year);
            return new Date(fullYear, monthMap[month], parseInt(day));
        };

        const date1 = parseDate(dateA);
        const date2 = parseDate(dateB);

        return date1.getTime() - date2.getTime();
    }

    /**
     * Validate sort field
     */
    static isValidSortField(field: string): field is SortField {
        const validFields: SortField[] = [
            'price', 'duration', 'departureTime', 'arrivalTime', 'stops', 'airline'
        ];
        return validFields.includes(field as SortField);
    }
}