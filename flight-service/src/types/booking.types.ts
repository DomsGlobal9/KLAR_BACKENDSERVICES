export type PaxType = 'ADULT' | 'CHILD' | 'INFANT';

export interface SSRInfo {
    key: string;
    code: string;
}

export interface FrontendTraveller {
    title: string;
    paxType: PaxType;
    firstName: string;
    lastName: string;
    dob?: string;
    passportNumber?: string;
    passportNationality?: string;
    passportIssueDate?: string;
    passportExpiryDate?: string;
    ssrSeatInfos?: SSRInfo[];
    ssrMealInfos?: SSRInfo[];
    ssrBaggageInfos?: SSRInfo[];
}

export interface FrontendBookingPayload {
    bookingId: string;
    amount: number;
    email: string;
    phone: string;
    isHold: boolean;
    travellers: FrontendTraveller[];

    gstInfo?: {
        gstNumber: string;
        registeredName: string;
        email: string;
        mobile: string;
        address: string;
    };

    emergencyContact?: {
        email: string;
        phone: string;
        name: string;
    };
}

export interface TripjackTraveller {
    ti: string;
    pt: PaxType;
    fN: string;
    lN: string;
    dob?: string;

    pNum?: string;
    pNat?: string;
    pid?: string;
    eD?: string;

    ssrSeatInfos?: SSRInfo[];
    ssrMealInfos?: SSRInfo[];
    ssrBaggageInfos?: SSRInfo[];
}

export interface TripjackBookingPayload {
    bookingId: string;
    paymentInfos?: { amount: number }[];

    deliveryInfo: {
        emails: string[];
        contacts: string[];
    };

    contactInfo?: {
        emails: string[];
        contacts: string[];
        ecn: string;
    };

    travellerInfo: TripjackTraveller[];

    gstInfo?: {
        gstNumber: string;
        registeredName: string;
        Email: string;
        Mobile: string;
        Address: string;
    };
}