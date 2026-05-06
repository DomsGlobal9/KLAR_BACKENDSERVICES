export interface FrontendBookingPayload {
    bookingID: string;
    paymentAmount?: number;
    travellers: FrontendTraveller[];
    gstInfo?: FrontendGSTInfo;
    deliveryEmails: string[];
    deliveryContacts: string[];
    emergencyContact?: FrontendEmergencyContact;
}

export interface FrontendTraveller {
    title: string;
    firstName: string;
    lastName: string;
    paxType: 'ADULT' | 'CHILD' | 'INFANT';
    dateOfBirth?: string;
    passportNumber?: string;
    passportNationality?: string;
    passportIssueDate?: string;
    passportExpiryDate?: string;
    documentId?: string;
    ssrBaggage?: Record<string, string>;
    ssrMeal?: Record<string, string>;
    ssrSeat?: Record<string, string>;
    ssrExtraService?: Record<string, string>;
}

export interface FrontendGSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address: string;
}

export interface FrontendEmergencyContact {
    name?: string;
    number?: string;
}

export interface TripJackBookingPayload {
    bookingId: string;
    paymentInfos?: Array<{ amount: number }>;
    travellerInfo: TripJackTraveller[];
    gstInfo?: TripJackGSTInfo;
    deliveryInfo: TripJackDeliveryInfo;
    contactInfo?: TripJackEmergencyContact;
}

export interface TripJackTraveller {
    ti: string;
    fN: string;
    lN: string;
    pt: string;
    dob?: string;
    pNum?: string;
    pNat?: string;
    pid?: string;
    eD?: string;
    di?: string;
    ssrBaggageInfos?: Array<{ key: string; code: string }>;
    ssrMealInfos?: Array<{ key: string; code: string }>;
    ssrSeatInfos?: Array<{ key: string; code: string }>;
    ssrExtraServiceInfos?: Array<{ key: string; code: string }>;
}

export interface TripJackGSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address: string;
}

export interface TripJackDeliveryInfo {
    emails: string[];
    contacts: string[];
}

export interface TripJackEmergencyContact {
    ecn: string;
    ec?: string;
}

export interface TripJackVerifierResult {
    success: boolean;
    payload?: TripJackBookingPayload;
    errors: string[];
}

export interface SimpleFrontendBookingPayload {
    bookingID: string;
    paymentAmount?: number;

    travellers: SimpleFrontendTraveller[];

    gstInfo?: SimpleFrontendGSTInfo;

    deliveryEmails: string[];
    deliveryContacts: string[];

    emergencyContact?: SimpleFrontendEmergencyContact;
}

export interface SimpleFrontendTraveller {
    title: string;
    firstName: string;
    lastName: string;
    paxType: 'ADULT' | 'CHILD' | 'INFANT';

    dateOfBirth?: string;
    passportNumber?: string;
    passportNationality?: string;
    passportIssueDate?: string;
    passportExpiryDate?: string;
    documentId?: string;


    ssrBaggage?: Array<{ segmentId: string; code: string }>;
    ssrMeal?: Array<{ segmentId: string; code: string }>;
    ssrSeat?: Array<{ segmentId: string; code: string }>;
    ssrExtraService?: Array<{ segmentId: string; code: string }>;
}

export interface SimpleFrontendGSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address: string;
}

export interface SimpleFrontendEmergencyContact {
    name?: string;
    number?: string;
}

export interface TripJackBookingPayload {
    bookingId: string;
    paymentInfos?: Array<{ amount: number }>;
    travellerInfo: TripJackTraveller[];
    gstInfo?: TripJackGSTInfo;
    deliveryInfo: TripJackDeliveryInfo;
    contactInfo?: TripJackEmergencyContact;
}

export interface TripJackTraveller {
    ti: string;
    fN: string;
    lN: string;
    pt: string;
    dob?: string;
    pNum?: string;
    pNat?: string;
    pid?: string;
    eD?: string;
    di?: string;
    ssrBaggageInfos?: Array<{ key: string; code: string }>;
    ssrMealInfos?: Array<{ key: string; code: string }>;
    ssrSeatInfos?: Array<{ key: string; code: string }>;
    ssrExtraServiceInfos?: Array<{ key: string; code: string }>;
}

export interface TripJackGSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address: string;
}

export interface TripJackDeliveryInfo {
    emails: string[];
    contacts: string[];
}

export interface TripJackEmergencyContact {
    ecn: string;
    ec?: string;
}


export interface SimpleFrontendBookingPayload {
    bookingID: string;
    paymentAmount?: number;
    travellers: SimpleFrontendTraveller[];
    gstInfo?: SimpleFrontendGSTInfo;
    deliveryEmails: string[];
    deliveryContacts: string[];
    emergencyContact?: SimpleFrontendEmergencyContact;
}

// export interface SimpleFrontendTraveller {
//     title: string;
//     firstName: string;
//     lastName: string;
//     paxType: 'ADULT' | 'CHILD' | 'INFANT';
//     dateOfBirth?: string;
//     passportNumber?: string;
//     passportNationality?: string;
//     passportIssueDate?: string;
//     passportExpiryDate?: string;
//     documentId?: string;
//     ssrBaggage?: Record<string, string>;
//     ssrMeal?: Record<string, string>;
//     ssrSeat?: Record<string, string>;
//     ssrExtraService?: Record<string, string>;
// }

export interface SimpleFrontendGSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address: string;
}

export interface SimpleFrontendEmergencyContact {
    name?: string;
    number?: string;
}

export interface TripJackBookingPayload {
    bookingId: string;
    paymentInfos?: Array<{ amount: number }>;
    travellerInfo: TripJackTraveller[];
    gstInfo?: TripJackGSTInfo;
    deliveryInfo: TripJackDeliveryInfo;
    contactInfo?: TripJackEmergencyContact;
}

export interface TripJackTraveller {
    ti: string;
    fN: string;
    lN: string;
    pt: string;
    dob?: string;
    pNum?: string;
    pNat?: string;
    pid?: string;
    eD?: string;
    di?: string;
    ssrBaggageInfos?: Array<{ key: string; code: string }>;
    ssrMealInfos?: Array<{ key: string; code: string }>;
    ssrSeatInfos?: Array<{ key: string; code: string }>;
    ssrExtraServiceInfos?: Array<{ key: string; code: string }>;
}

export interface TripJackGSTInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address: string;
}

export interface TripJackDeliveryInfo {
    emails: string[];
    contacts: string[];
}

export interface TripJackEmergencyContact {
    ecn: string;
    ec?: string;
}