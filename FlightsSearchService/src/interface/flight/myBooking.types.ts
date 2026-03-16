export interface BookingQueryParams {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    success: boolean;
    message: string;
    data: {
        bookings: T[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalItems: number;
            itemsPerPage: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
    };
}

export interface ValidatedUser {
    id: string;
    userId: string;
    email: string;
    name?: string;
    role?: string;
}

export interface TokenValidationResponse {
    success: boolean;
    message?: string;
    data: ValidatedUser;
}

export interface BookingQueryParams {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
