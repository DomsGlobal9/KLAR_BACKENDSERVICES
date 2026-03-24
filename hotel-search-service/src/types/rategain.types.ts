export interface RateGainGuest {
    FirstName: string;
    LastName: string;
    Primary: boolean;
    Remarks?: string;
    ServiceRequest?: string;
    Email: string;
    EmailType?: number;
    ProfileType?: number;
    Phone: string;
    Line1?: string;
    City?: string;
    StateCode?: string;
    CountryCode?: string;
    PostalCode?: string;
}

export interface RateGainChild {
    type: string;
    age: number;
}

export interface RateGainRoomSelection {
    RoomTypeCode: string;
    NumberOfRooms: number;
    NumberOfAdults: number;
    NumberOfChild: number;
    allocationDetails?: string;
    RoomSelectionKey: string;
    RoomRate: number;
    BoardName: string;
    Comment?: string;
    SpecialRequest?: string;
    Guest: RateGainGuest[];
    Children: RateGainChild[];
}

export interface RateGainCreditCard {
    ExpirationDate: string; // YYYY-MM
    IssuedName: string;
    Number: string;
    TypeIdentifier: string; // VISA, MASTERCARD, etc.
}

export interface RateGainBookReservation {
    ResStatus: number;
    DemandBookingId?: string;
    CurrencyCode: string;
    GuaranteeMethod: string;
    GuaranteeType: string;
    TimeStamp?: string;
    checkin: string;
    checkout: string;
    ReservationDate?: string;
    propertyID: string;
    PropertyCode: string;
    BrandCode: string;
    EchoToken: string;
    BookingRate: number;
    sellingRate?: number;
    Session: string;
    CountryCode?: string;
    Currency?: string;
    CreditCard?: RateGainCreditCard;
    RoomSelection: RateGainRoomSelection[];
}

export interface PreCheckRequest {
    BookReservation: RateGainBookReservation;
}

export interface CommitRequest {
    BookReservation: RateGainBookReservation;
}

export interface CancelRequest {
    ConfirmationNumber: string;
    DemandCancelId?: string;
    ReservationId: string;
    EchoToken: string;
    PropertyId: string;
    BrandCode: string; // Required by API even if missing from some documentation
    TimeStamp?: string;
    PropertyCode: string;
}


export interface RateGainResponse<T> {
    status: boolean;
    data: T;
    message?: string;
    errors?: any[];
}
