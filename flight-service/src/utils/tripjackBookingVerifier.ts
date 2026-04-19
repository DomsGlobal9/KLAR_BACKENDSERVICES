import {
    FrontendBookingPayload,
    TripJackBookingPayload,
    TripJackTraveller,
    TripJackVerifierResult,
} from "../types/flightBook.types";

export const FRONTEND_TO_TRIPJACK_MAP: Record<string, string> = {
    bookingID: 'bookingId',
    paymentAmount: 'amount',
    title: 'ti',
    firstName: 'fN',
    lastName: 'lN',
    paxType: 'pt',
    dateOfBirth: 'dob',
    passportNumber: 'pNum',
    passportNationality: 'pNat',
    passportIssueDate: 'pid',
    passportExpiryDate: 'eD',
    documentId: 'di',
    gstNumber: 'gstNumber',
    registeredName: 'registeredName',
    email: 'email',
    mobile: 'mobile',
    address: 'address',
    name: 'ecn',
    number: 'ec',
};

function validateBookingId(frontend: FrontendBookingPayload, errors: string[]): string | null {
    if (!frontend.bookingID?.trim()) {
        errors.push('bookingID is required');
        return null;
    }
    return frontend.bookingID.trim();
}

function buildPaymentInfos(
    frontend: FrontendBookingPayload,
    isInstantBook: boolean,
    errors: string[]
): Array<{ amount: number }> | undefined {
    if (!isInstantBook) return undefined;

    if (typeof frontend.paymentAmount !== 'number' || frontend.paymentAmount <= 0) {
        errors.push('paymentAmount is required and must be greater than 0 for Instant Book');
        return undefined;
    }
    return [{ amount: frontend.paymentAmount }];
}

function buildDeliveryInfo(frontend: FrontendBookingPayload, errors: string[]) {
    if (!frontend.deliveryEmails?.length) {
        errors.push('At least one delivery email is required');
    }
    if (!frontend.deliveryContacts?.length) {
        errors.push('At least one delivery contact is required');
    }

    return {
        emails: frontend.deliveryEmails ?? [],
        contacts: frontend.deliveryContacts ?? [],
    };
}

function buildEmergencyContact(frontend: FrontendBookingPayload) {
    if (!frontend.emergencyContact?.name) return undefined;

    const contact: any = { ecn: frontend.emergencyContact.name };
    if (frontend.emergencyContact.number) {
        contact.ec = frontend.emergencyContact.number;
    }
    return contact;
}

function buildGstInfo(frontend: FrontendBookingPayload, errors: string[]) {
    if (!frontend.gstInfo) return undefined;

    const g = frontend.gstInfo;
    if (!g.gstNumber || !g.registeredName || !g.address) {
        errors.push('GST info is incomplete (gstNumber, registeredName, address are required)');
    }

    return {
        gstNumber: g.gstNumber,
        registeredName: g.registeredName,
        email: g.email,
        mobile: g.mobile,
        address: g.address,
    };
}

function buildTraveller(t: any, index: number, errors: string[]): TripJackTraveller {
    const traveller: TripJackTraveller = {
        ti: t.title,
        fN: t.firstName,
        lN: t.lastName,
        pt: t.paxType,
    };

    if (t.dateOfBirth) traveller.dob = t.dateOfBirth;

    if (t.passportNumber) traveller.pNum = t.passportNumber;
    if (t.passportNationality) traveller.pNat = t.passportNationality;
    if (t.passportIssueDate) traveller.pid = t.passportIssueDate;
    if (t.passportExpiryDate) traveller.eD = t.passportExpiryDate;
    if (t.documentId) traveller.di = t.documentId;

    if (t.ssrBaggage?.length) {
        traveller.ssrBaggageInfos = t.ssrBaggage.map((item: any) => ({
            key: item.segmentId,
            code: item.code
        }));
    }
    if (t.ssrMeal?.length) {
        traveller.ssrMealInfos = t.ssrMeal.map((item: any) => ({
            key: item.segmentId,
            code: item.code
        }));
    }
    if (t.ssrSeat?.length) {
        traveller.ssrSeatInfos = t.ssrSeat.map((item: any) => ({
            key: item.segmentId,
            code: item.code
        }));
    }
    if (t.ssrExtraService?.length) {
        traveller.ssrExtraServiceInfos = t.ssrExtraService.map((item: any) => ({
            key: item.segmentId,
            code: item.code
        }));
    }

    if (!t.title) errors.push(`Traveller ${index + 1}: title is required`);
    if (!t.firstName) errors.push(`Traveller ${index + 1}: firstName is required`);
    if (!t.lastName) errors.push(`Traveller ${index + 1}: lastName is required`);
    if (!t.paxType) errors.push(`Traveller ${index + 1}: paxType is required`);

    return traveller;
}

export function verifyAndTransformTripJackBookingPayload(
    frontend: FrontendBookingPayload,
    isInstantBook: boolean = true
): TripJackVerifierResult {
    const errors: string[] = [];
    const payload: any = {};

    const bookingId = validateBookingId(frontend, errors);
    if (bookingId) payload.bookingId = bookingId;

    const paymentInfos = buildPaymentInfos(frontend, isInstantBook, errors);
    if (paymentInfos) payload.paymentInfos = paymentInfos;

    payload.deliveryInfo = buildDeliveryInfo(frontend, errors);

    const emergencyContact = buildEmergencyContact(frontend);
    if (emergencyContact) payload.contactInfo = emergencyContact;

    const gstInfo = buildGstInfo(frontend, errors);
    if (gstInfo) payload.gstInfo = gstInfo;

    if (!frontend.travellers?.length) {
        errors.push('At least one traveller is required');
    } else {
        payload.travellerInfo = frontend.travellers.map((t, i) =>
            buildTraveller(t, i, errors)
        );
    }

    const success = errors.length === 0;

    return {
        success,
        payload: success ? (payload as TripJackBookingPayload) : undefined,
        errors,
    };
}