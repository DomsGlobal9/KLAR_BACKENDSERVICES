import {
    CursorPaginationOptions,
    CursorPaginatedResponse,
    ReturnCursorResponse,
    DEFAULT_CURSOR_LIMIT,
    MAX_CURSOR_LIMIT
} from "../../interface/cursor-pagination.interface";
import { TransformedFlight } from "../../interface/flight/flight.interface";

type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

export class CursorPagination {
    /**
     * Validate and get cursor pagination options from query params
     */
    static validateOptions(query: any): CursorPaginationOptions {
        const limit = parseInt(query.limit) || DEFAULT_CURSOR_LIMIT;
        const cursor = query.cursor || undefined;
        const sortBy = query.sortBy || 'price';
        const sortOrder = query.sortOrder || 'asc';

        return {
            limit: Math.min(Math.max(1, limit), MAX_CURSOR_LIMIT),
            cursor,
            sortBy: ['price', 'duration', 'departureTime', 'arrivalTime'].includes(sortBy) ? sortBy : 'price',
            sortOrder: ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'asc'
        };
    }

    /**
     * Generate cursor from flight data
     */
    static generateCursor(flight: any, sortBy: string, sortOrder: string): string {
        let sortValue: any;

        switch (sortBy) {
            case 'price':
                sortValue = flight.fareOptions?.[0]?.netFare || flight.netFare || 0;
                break;
            case 'duration':
                sortValue = flight.duration || 0;
                break;
            case 'departureTime':
                sortValue = flight.departure?.datetime || flight.departure?.time || '';
                break;
            case 'arrivalTime':
                sortValue = flight.arrival?.datetime || flight.arrival?.time || '';
                break;
            default:
                sortValue = flight.fareOptions?.[0]?.netFare || 0;
        }

        const cursorData = {
            sortValue,
            flightId: flight.flightId,
            timestamp: Date.now()
        };

        return Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    /**
     * Decode cursor to get pagination parameters
     */
    static decodeCursor(cursor: string): { sortValue: any; flightId: string; timestamp: number } | null {
        try {
            const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
            return JSON.parse(decoded);
        } catch (error) {
            return null;
        }
    }

    /**
     * Sort flights based on cursor options
     */
    static sortFlights(flights: TransformedFlight[], sortBy: string, sortOrder: string): TransformedFlight[] {
        return [...flights].sort((a, b) => {
            let valueA: any;
            let valueB: any;

            switch (sortBy) {
                case 'price':
                    valueA = a.fareOptions?.[0]?.netFare || 0;
                    valueB = b.fareOptions?.[0]?.netFare || 0;
                    break;
                case 'duration':
                    valueA = a.duration || 0;
                    valueB = b.duration || 0;
                    break;
                case 'departureTime':
                    valueA = a.departure?.datetime || a.departure?.time || '';
                    valueB = b.departure?.datetime || b.departure?.time || '';
                    break;
                case 'arrivalTime':
                    valueA = a.arrival?.datetime || a.arrival?.time || '';
                    valueB = b.arrival?.datetime || b.arrival?.time || '';
                    break;
                default:
                    valueA = a.fareOptions?.[0]?.netFare || 0;
                    valueB = b.fareOptions?.[0]?.netFare || 0;
            }

            if (sortOrder === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
    }

    /**
     * Apply cursor pagination to sorted flights
     */
    static applyCursor(
        sortedFlights: TransformedFlight[],
        cursor: string | undefined,
        limit: number,
        sortBy: string,
        sortOrder: string
    ): CursorPaginatedResponse<TransformedFlight> {
        let startIndex = 0;

        if (cursor) {
            const cursorData = this.decodeCursor(cursor);
            if (cursorData) {
                const index = sortedFlights.findIndex(flight => flight.flightId === cursorData.flightId);
                if (index !== -1) {
                    startIndex = index + 1;
                }
            }
        }

        const paginatedData = sortedFlights.slice(startIndex, startIndex + limit);
        const hasMore = startIndex + limit < sortedFlights.length;
        const nextCursor = hasMore ? this.generateCursor(paginatedData[paginatedData.length - 1], sortBy, sortOrder) : null;

        return {
            data: paginatedData,
            nextCursor,
            hasMore,
            total: sortedFlights.length,
            limit,
            sortBy,
            sortOrder
        };
    }

    /**
     * Paginate ONE_WAY flights with cursor
     */
    static paginateOneWay(
        flights: TransformedFlight[],
        options: CursorPaginationOptions
    ): CursorPaginatedResponse<TransformedFlight> {
        const { limit, cursor, sortBy, sortOrder } = options;

        const sortedFlights = this.sortFlights(flights, sortBy!, sortOrder!);

        return this.applyCursor(sortedFlights, cursor, limit, sortBy!, sortOrder!);
    }

    /**
     * Paginate RETURN flights with separate cursors for onward and return
     */
    static paginateReturn(
        onwardFlights: TransformedFlight[],
        returnFlights: TransformedFlight[],
        options: CursorPaginationOptions
    ): ReturnCursorResponse {
        const { limit, sortBy, sortOrder } = options;

        let onwardCursor: string | undefined;
        let returnCursor: string | undefined;

        if (options.cursor) {
            try {
                const decoded = Buffer.from(options.cursor, 'base64').toString('utf-8');
                const cursors = JSON.parse(decoded);
                onwardCursor = cursors.onwardCursor;
                returnCursor = cursors.returnCursor;
            } catch (error) {
                // Invalid cursor
            }
        }

        const sortedOnward = this.sortFlights(onwardFlights, sortBy!, sortOrder!);
        const onwardResult = this.applyCursor(sortedOnward, onwardCursor, limit, sortBy!, sortOrder!);

        const sortedReturn = this.sortFlights(returnFlights, sortBy!, sortOrder!);
        const returnResult = this.applyCursor(sortedReturn, returnCursor, limit, sortBy!, sortOrder!);

        return {
            onward: {
                data: onwardResult.data,
                nextCursor: onwardResult.nextCursor,
                hasMore: onwardResult.hasMore
            },
            return: {
                data: returnResult.data,
                nextCursor: returnResult.nextCursor,
                hasMore: returnResult.hasMore
            },
            onwardCursor: onwardResult.nextCursor || undefined,
            returnCursor: returnResult.nextCursor || undefined
        };
    }

    /**
     * Paginate MULTI_CITY flights with cursor
     */
    static paginateMultiCity(
        legs: { legNumber: number; legKey: string; flights: TransformedFlight[] }[],
        options: CursorPaginationOptions
    ): CursorPaginatedResponse<{ legNumber: number; legKey: string; flights: TransformedFlight[] }> {
        const { limit, cursor, sortBy, sortOrder } = options;

        interface FlightWithLeg {
            legNumber: number;
            legKey: string;
            flight: TransformedFlight;
        }

        const allFlightsWithLeg: FlightWithLeg[] = [];
        legs.forEach(leg => {
            leg.flights.forEach(flight => {
                allFlightsWithLeg.push({
                    legNumber: leg.legNumber,
                    legKey: leg.legKey,
                    flight
                });
            });
        });

        const sortedFlightsWithLeg = this.sortFlightsWithLeg(allFlightsWithLeg, sortBy!, sortOrder!);

        let startIndex = 0;
        if (cursor) {
            const cursorData = this.decodeCursor(cursor);
            if (cursorData) {
                const index = sortedFlightsWithLeg.findIndex(item => item.flight.flightId === cursorData.flightId);
                if (index !== -1) {
                    startIndex = index + 1;
                }
            }
        }

        const paginatedItems = sortedFlightsWithLeg.slice(startIndex, startIndex + limit);
        const hasMore = startIndex + limit < sortedFlightsWithLeg.length;

        const resultMap = new Map<number, { legNumber: number; legKey: string; flights: TransformedFlight[] }>();

        paginatedItems.forEach(item => {
            if (!resultMap.has(item.legNumber)) {
                resultMap.set(item.legNumber, {
                    legNumber: item.legNumber,
                    legKey: item.legKey,
                    flights: []
                });
            }
            resultMap.get(item.legNumber)!.flights.push(item.flight);
        });

        const result = Array.from(resultMap.values());
        const nextCursor = hasMore ? this.generateCursor(paginatedItems[paginatedItems.length - 1].flight, sortBy!, sortOrder!) : null;

        return {
            data: result,
            nextCursor,
            hasMore,
            total: allFlightsWithLeg.length,
            limit,
            sortBy: sortBy!,
            sortOrder: sortOrder!
        };
    }

    /**
     * Sort flights with leg information
     */
    private static sortFlightsWithLeg(
        flightsWithLeg: { legNumber: number; legKey: string; flight: TransformedFlight }[],
        sortBy: string,
        sortOrder: string
    ): { legNumber: number; legKey: string; flight: TransformedFlight }[] {
        return [...flightsWithLeg].sort((a, b) => {
            let valueA: any;
            let valueB: any;

            switch (sortBy) {
                case 'price':
                    valueA = a.flight.fareOptions?.[0]?.netFare || 0;
                    valueB = b.flight.fareOptions?.[0]?.netFare || 0;
                    break;
                case 'duration':
                    valueA = a.flight.duration || 0;
                    valueB = b.flight.duration || 0;
                    break;
                case 'departureTime':
                    valueA = a.flight.departure?.datetime || a.flight.departure?.time || '';
                    valueB = b.flight.departure?.datetime || b.flight.departure?.time || '';
                    break;
                case 'arrivalTime':
                    valueA = a.flight.arrival?.datetime || a.flight.arrival?.time || '';
                    valueB = b.flight.arrival?.datetime || b.flight.arrival?.time || '';
                    break;
                default:
                    valueA = a.flight.fareOptions?.[0]?.netFare || 0;
                    valueB = b.flight.fareOptions?.[0]?.netFare || 0;
            }

            if (sortOrder === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
    }

    /**
     * Main pagination function - Entry point for all trip types
     */
    static paginate(
        flightData: any,
        tripType: TripType,
        options: CursorPaginationOptions
    ): CursorPaginatedResponse<any> | ReturnCursorResponse {
        if (!flightData) {
            return {
                data: [],
                nextCursor: null,
                hasMore: false,
                total: 0,
                limit: options.limit,
                sortBy: options.sortBy!,
                sortOrder: options.sortOrder!
            };
        }

        switch (tripType) {
            case 'ONE_WAY':
                return this.paginateOneWay(flightData as TransformedFlight[], options);
            case 'RETURN':
                return this.paginateReturn(
                    flightData.onward || [],
                    flightData.return || [],
                    options
                );
            case 'MULTI_CITY':
                return this.paginateMultiCity(flightData as any[], options);
            default:
                return {
                    data: flightData,
                    nextCursor: null,
                    hasMore: false,
                    total: Array.isArray(flightData) ? flightData.length : 0,
                    limit: options.limit,
                    sortBy: options.sortBy!,
                    sortOrder: options.sortOrder!
                };
        }
    }
}