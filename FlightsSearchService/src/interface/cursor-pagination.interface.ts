export interface CursorPaginationOptions {
    limit: number;
    cursor?: string; 
    sortBy?: 'price' | 'duration' | 'departureTime' | 'arrivalTime';
    sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginatedResponse<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
    total?: number; 
    limit: number;
    sortBy: string;
    sortOrder: string;
}

export interface ReturnCursorResponse {
    onward: {
        data: any[];
        nextCursor: string | null;
        hasMore: boolean;
    };
    return: {
        data: any[];
        nextCursor: string | null;
        hasMore: boolean;
    };
    onwardCursor?: string;
    returnCursor?: string;
}

export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;