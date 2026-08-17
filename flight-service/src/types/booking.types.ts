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
    /** Student / senior-citizen document id — required when `dc.idm` (H-7). */
    documentId?: string;
    di?: string;
    /** PAN — collected when `ipa` is true (H-8). */
    pan?: string;
    ssrSeatInfos?: SSRInfo[];
    ssrMealInfos?: SSRInfo[];
    ssrBaggageInfos?: SSRInfo[];
    ssrExtraServiceInfos?: SSRInfo[];
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

    /** Document Id — Flights 1.8.2 p. 53 (H-7). */
    di?: string;
    /** PAN number — Air 2.0 p. 54 (H-8). */
    pan?: string;

    ssrSeatInfos?: SSRInfo[];
    ssrMealInfos?: SSRInfo[];
    ssrBaggageInfos?: SSRInfo[];
    ssrExtraServiceInfos?: SSRInfo[];
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
        Email?: string;
        Mobile?: string;
        Address?: string;
    };
}

/**
 * Normalised TripJack Review conditions, resolved once and shared by the
 * frontend form and the backend validator (C-4). Mirrors
 * `BookingRequirements` in utils/reviewConditions.util.ts.
 */
export interface BookingRequirementsInput {
    passport: { required: boolean; expiryRequired: boolean; issueDateRequired: boolean };
    dob: { adult: boolean; child: boolean; infant: boolean };
    gst: { applicable: boolean; mandatory: boolean };
    emergencyContact: { required: boolean };
    documentId: { applicable: boolean; mandatory: boolean };
    pan: { applicable: boolean };
    seat: { applicable: boolean };
    hold: { allowed: boolean };
    session: { validSeconds: number | null; createdAt: string | null };
}