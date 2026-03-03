import {
    PaginationOptions,
    PaginatedResponse,
    DEFAULT_PAGINATION
} from "../../interface/flight/pagination.interface";
import { TransformedFlight } from "../../interface/flight/flight.interface";

type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

export class FlightPagination {
    /**
     * Validate and get pagination options from query params
     */
    static validateOptions(query: any): PaginationOptions {
        const page = parseInt(query.page) || DEFAULT_PAGINATION.page;
        const limit = parseInt(query.limit) || DEFAULT_PAGINATION.limit;

        return {
            page: page < 1 ? 1 : page,
            limit: limit < 1 ? DEFAULT_PAGINATION.limit : limit > 100 ? 100 : limit
        };
    }

    /**
     * Paginate ONE_WAY flights
     */
    static paginateOneWay(
        flights: TransformedFlight[],
        options: PaginationOptions
    ): PaginatedResponse<TransformedFlight> {
        const { page, limit } = options;
        const totalItems = flights.length;
        const totalPages = Math.ceil(totalItems / limit);
        const currentPage = Math.min(page, totalPages || 1);
        const startIndex = (currentPage - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedData = flights.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            pagination: {
                currentPage,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
                nextPage: currentPage < totalPages ? currentPage + 1 : null,
                prevPage: currentPage > 1 ? currentPage - 1 : null
            }
        };
    }

    /**
     * Paginate RETURN flight combinations
     */
    static paginateReturn(
        combinations: any[],
        options: PaginationOptions
    ): PaginatedResponse<any> {
        const { page, limit } = options;
        const totalItems = combinations.length;
        const totalPages = Math.ceil(totalItems / limit);
        const currentPage = Math.min(page, totalPages || 1);
        const startIndex = (currentPage - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedData = combinations.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            pagination: {
                currentPage,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
                nextPage: currentPage < totalPages ? currentPage + 1 : null,
                prevPage: currentPage > 1 ? currentPage - 1 : null
            }
        };
    }

    /**
     * Paginate MULTI_CITY flights
     */
    static paginateMultiCity(
        legs: { legNumber: number; legKey: string; flights: TransformedFlight[] }[],
        options: PaginationOptions
    ): PaginatedResponse<{ legNumber: number; legKey: string; flights: TransformedFlight[] }> {
        const paginatedLegs = legs.map(leg => ({
            ...leg,
            flights: this.paginateOneWay(leg.flights, options).data
        }));

        const totalItems = legs.length;

        return {
            data: paginatedLegs,
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalItems,
                itemsPerPage: totalItems,
                hasNextPage: false,
                hasPrevPage: false,
                nextPage: null,
                prevPage: null
            }
        };
    }

    /**
     * Main pagination function - Entry point for all trip types
     */
    static paginate(
        flightData: any,
        tripType: TripType,
        options: PaginationOptions
    ): PaginatedResponse<any> {
        if (!flightData) {
            return {
                data: [],
                pagination: {
                    currentPage: options.page,
                    totalPages: 0,
                    totalItems: 0,
                    itemsPerPage: options.limit,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: null,
                    prevPage: null
                }
            };
        }

        switch (tripType) {
            case 'ONE_WAY':
                return this.paginateOneWay(flightData as TransformedFlight[], options);
            case 'RETURN':
                return this.paginateReturn(flightData as any[], options);
            case 'MULTI_CITY':
                return this.paginateMultiCity(flightData as any[], options);
            default:
                return {
                    data: flightData,
                    pagination: {
                        currentPage: 1,
                        totalPages: 1,
                        totalItems: Array.isArray(flightData) ? flightData.length : Object.keys(flightData).length,
                        itemsPerPage: options.limit,
                        hasNextPage: false,
                        hasPrevPage: false,
                        nextPage: null,
                        prevPage: null
                    }
                };
        }
    }

    /**
     * Get pagination metadata without data
     */
    static getMetadata(
        totalItems: number,
        options: PaginationOptions
    ): PaginatedResponse<any>['pagination'] {
        const { page, limit } = options;
        const totalPages = Math.ceil(totalItems / limit);
        const currentPage = Math.min(page, totalPages || 1);

        return {
            currentPage,
            totalPages,
            totalItems,
            itemsPerPage: limit,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1,
            nextPage: currentPage < totalPages ? currentPage + 1 : null,
            prevPage: currentPage > 1 ? currentPage - 1 : null
        };
    }
}