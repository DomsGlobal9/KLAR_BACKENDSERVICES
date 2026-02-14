export interface SeatMapRequest {
    bookingId: string;
}

export interface SeatMapResponse {
    tripSeatMap: {
        tripSeat: Record<string, TripSeatInfo>;
    };
    bookingId: string;
    status: {
        success: boolean;
        httpStatus: number;
    };
}

export interface TripSeatInfo {
    sData: {
        row: number;
        column: number;
    };
    sInfo: SeatInfo[];
}

export interface SeatInfo {
    seatNo: string;
    seatPosition: {
        row: number;
        column: number;
    };
    isBooked: boolean;
    isLegroom?: boolean;
    isAisle?: boolean;
    isWindow?: boolean;
    isExit?: boolean;
    code: string;
    amount: number;
    currency?: string;
    availabilityType?: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'UNAVAILABLE';
}

export interface TransformedSeatMap {
    bookingId: string;
    flights: TransformedFlightSeatMap[];
    status: {
        success: boolean;
        httpStatus: number;
    };
}

export interface TransformedFlightSeatMap {
    segmentId: string;
    seatMap: {
        rows: TransformedSeatRow[];
        summary: {
            totalSeats: number;
            availableSeats: number;
            bookedSeats: number;
            blockedSeats: number;
            legroomSeats: number;
            aisleSeats: number;
            windowSeats: number;
            priceRange: {
                min: number;
                max: number;
            };
        };
    };
}

export interface TransformedSeatRow {
    rowNumber: number;
    seats: TransformedSeat[];
}

export interface TransformedSeat {
    seatNo: string;
    row: number;
    column: number;
    isBooked: boolean;
    isAvailable: boolean;
    isLegroom?: boolean;
    isAisle?: boolean;
    isWindow?: boolean;
    isExit?: boolean;
    price: number;
    currency?: string;
    features: string[];
}