export type PaxType = "ADULT" | "CHILD" | "INFANT";

export interface UserInfo {
    id: string;
    email: string;
    role: string;
    clientType: string;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    filter?: 'all' | 'upcoming' | 'past' | 'cancelled';
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export interface SSRInfo {
    key: string;
    code: string;
}

export interface Traveller {
    travellerId: string;
    title: string;
    paxType: PaxType;
    firstName: string;
    lastName: string;
    dob: string;
    passportNumber?: string;
    passportNationality?: string;
    passportIssueDate?: string;
    passportExpiryDate?: string;
    ssrSeatInfos?: SSRInfo[];
    ssrMealInfos?: SSRInfo[];
    ssrBaggageInfos?: SSRInfo[];
}

export interface GSTInfo {
    gstNumber: string;
    registeredName: string;
    email: string;
    mobile: string;
    address: string;
}

export interface EmergencyContact {
    email: string;
    phone: string;
    name: string;
}

export interface FlightSegment {
    departureDate: string;
    departureTime?: string;
    arrivalDate?: string;
    arrivalTime?: string;
    origin?: string;
    destination?: string;
    airline?: string;
    flightNumber?: string;
}

export interface Booking {
    bookingId: string;
    amount?: number;
    tripjackPrice?: number;
    markupPrice?: number;
    totalPrice?: number;
    email: string;
    phone: string;
    isHold: boolean;
    travellers: Traveller[];
    gstInfo?: GSTInfo;
    emergencyContact?: EmergencyContact;
    userInfo?: UserInfo;
    flightSegments?: FlightSegment[];
    departureDate: string;
    status:
    | "INITIATED"
    | "SUCCESS"
    | "ON_HOLD"
    | "CANCELLED"
    | "FAILED"
    | "PENDING"
    | "ABORTED"
    | "UNCONFIRMED"
    | "REQUESTED"
    | "REJECTED"
    | "NO_SHOW"
    | "VOIDED"
    | "REISSUED"
    | "CANCEL_REQUESTED"
    | "CONFIRMED";
    amendmentId?: string;
    refundProcessed?: boolean;
    refundPrice?: string;
    refundDate?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}