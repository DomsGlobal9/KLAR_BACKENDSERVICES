export interface PaginationOptions {
    page: number;
    limit: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
        nextPage: number | null;
        prevPage: number | null;
    };
}

export interface PaginatedFlightResult<T> {
    paginatedData: T[];
    pagination: PaginatedResponse<T>['pagination'];
}

export const DEFAULT_PAGINATION: PaginationOptions = {
    page: 1,
    limit: 10
};