export type PaxType = "ADULT" | "CHILD" | "INFANT";

export interface UserInfo {
    id: string;
    email: string;
    role: string;
    clientType: string;
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

    status:
    | "INITIATED"
    | "PENDING"
    | "CONFIRMED"
    | "FAILED"
    | "CANCEL_REQUESTED"
    | "CANCELLED";

    amendmentId?: string;

    createdAt?: Date;
    updatedAt?: Date;
}