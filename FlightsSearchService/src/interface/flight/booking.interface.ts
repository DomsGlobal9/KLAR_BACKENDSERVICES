export interface InstantBookingRequest {
    bookingId: string;
    paymentInfos: PaymentInfo[];
    travellerInfo: TravellerInfo[];
    deliveryInfo: DeliveryInfo;
    contactInfo?: ContactInfo;
    gstInfo?: GSTInfo;
}

export interface PaymentInfo {
    amount: number;
}

export interface DeliveryInfo {
    emails: string[];
    contacts: string[];
}

export interface ContactInfo {
    emails: string[];
    contacts: string[];
    ecn: string;
}

export interface GSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address?: string;
}

export interface TravellerInfo {
    ti: Title;
    pt: PaxType;
    fN: string;
    lN: string;
    dob?: string;
    pNum?: string;
    eD?: string;
    pNat?: string;
    pid?: string;
    di?: string;
    ssrBaggageInfos?: SSRInfo[];
    ssrMealInfos?: SSRInfo[];
    ssrSeatInfos?: SSRInfo[];
    ssrExtraServiceInfos?: SSRInfo[];
}

export type Title = 'Mr' | 'Mrs' | 'Ms' | 'Master';
export type PaxType = 'ADULT' | 'CHILD' | 'INFANT';

export interface SSRInfo {
    key: string;
    code: string;
}

export interface InstantBookingResponse {
    bookingId: string;
    status: {
        success: boolean;
        httpStatus: number;
        errors?: Array<{
            errCode: string;
            message: string;
        }>;
    };
    order?: {
        bookingId: string;
        amount: number;
        status: 'SUCCESS' | 'ON_HOLD' | 'PENDING' | 'FAILED' | 'CANCELLED';
        pnr?: string;
        ticketNumber?: string;
    };
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}