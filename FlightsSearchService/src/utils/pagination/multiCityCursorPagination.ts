import { TransformedFlight } from "../../interface/flight/flight.interface";


export interface MultiCityCursorOptions {
    limit: number;
    cursor?: string;
    sortBy?: 'price' | 'duration' | 'departureTime' | 'arrivalTime';
    sortOrder?: 'asc' | 'desc';
}

export interface MultiCityPaginatedResponse {
    data: {
        legNumber: number;
        legKey: string;
        flights: TransformedFlight[];
        nextCursor: string | null;
        hasMore: boolean;
        totalFlights: number;
    }[];
    hasMore: boolean;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export class MultiCityCursorPagination {
    static validateOptions(query: any): MultiCityCursorOptions {
        const limit = parseInt(query.limit) || DEFAULT_LIMIT;
        const sortBy = query.sortBy || 'price';
        const sortOrder = query.sortOrder || 'asc';

        return {
            limit: Math.min(Math.max(1, limit), MAX_LIMIT),
            cursor: query.cursor || undefined,
            sortBy: ['price', 'duration', 'departureTime', 'arrivalTime'].includes(sortBy)
                ? sortBy as any
                : 'price',
            sortOrder: ['asc', 'desc'].includes(sortOrder)
                ? sortOrder as any
                : 'asc',
        };
    }

    static generateCursor(flight: TransformedFlight, sortBy: string, sortOrder: string): string {
        let sortValue: any;

        switch (sortBy) {
            case 'price':
                sortValue = flight.fareOptions?.[0]?.netFare || 0;
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
            legKey: flight.legKey,
            timestamp: Date.now()
        };

        return Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    static decodeCursor(cursor: string): { sortValue: any; flightId: string; legKey: string; timestamp: number } | null {
        try {
            const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
            return JSON.parse(decoded);
        } catch {
            return null;
        }
    }

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

    static paginate(
        legs: { legNumber: number; legKey: string; flights: TransformedFlight[] }[],
        options: MultiCityCursorOptions
    ): MultiCityPaginatedResponse {
        const { limit, cursor, sortBy = 'price', sortOrder = 'asc' } = options;

        // Parse cursor to get which leg we're on
        let currentLegKey: string | null = null;
        let currentCursor: string | undefined = cursor;

        if (cursor) {
            const cursorData = this.decodeCursor(cursor);
            if (cursorData) {
                currentLegKey = cursorData.legKey;
            }
        }

        // Process each leg independently
        const resultLegs = [];
        let foundStartLeg = !currentLegKey;
        let globalHasMore = false;

        for (const leg of legs) {
            // Skip legs until we reach the cursor leg
            if (!foundStartLeg && leg.legKey !== currentLegKey) {
                resultLegs.push({
                    legNumber: leg.legNumber,
                    legKey: leg.legKey,
                    flights: [],
                    nextCursor: null,
                    hasMore: true,
                    totalFlights: leg.flights.length
                });
                continue;
            }
            foundStartLeg = true;

            // Sort flights in this leg
            const sortedFlights = this.sortFlights(leg.flights, sortBy, sortOrder);

            // Find start index for this leg
            let startIndex = 0;
            let legCursor = currentLegKey === leg.legKey ? currentCursor : undefined;

            if (legCursor) {
                const cursorData = this.decodeCursor(legCursor);
                if (cursorData) {
                    const index = sortedFlights.findIndex(flight => flight.flightId === cursorData.flightId);
                    if (index !== -1) {
                        startIndex = index + 1;
                    }
                }
            }

            // Paginate this leg
            const paginatedFlights = sortedFlights.slice(startIndex, startIndex + limit);
            const hasMore = startIndex + limit < sortedFlights.length;
            const nextCursor = hasMore
                ? this.generateCursor(paginatedFlights[paginatedFlights.length - 1], sortBy, sortOrder)
                : null;

            resultLegs.push({
                legNumber: leg.legNumber,
                legKey: leg.legKey,
                flights: paginatedFlights,
                nextCursor,
                hasMore,
                totalFlights: sortedFlights.length,
            });

            if (hasMore) {
                globalHasMore = true;
            }

            // Reset cursor after first leg with data
            if (currentLegKey === leg.legKey) {
                currentCursor = undefined;
                currentLegKey = null;
            }
        }

        return {
            data: resultLegs,
            hasMore: globalHasMore,
        };
    }
}