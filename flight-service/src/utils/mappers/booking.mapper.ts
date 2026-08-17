import {
    FrontendBookingPayload,
    FrontendTraveller,
    TripjackBookingPayload,
    TripjackTraveller
} from "../../types/booking.types";

function mapTraveller(t: FrontendTraveller): TripjackTraveller {
    const traveller: TripjackTraveller = {
        ti: t.title,
        pt: t.paxType,
        fN: t.firstName,
        lN: t.lastName,
        ...(t.dob && { dob: t.dob })
    };

    if (t.documentId || t.di) {
        traveller.di = t.documentId || t.di;
    }

    // Each passport field is forwarded on its own merit (H-6). The previous
    // all-or-nothing rule dropped the entire block whenever one field was
    // absent, so a fare requiring only the passport number (pm=true, pped and
    // pid false) went upstream with no passport at all and was rejected.
    if (t.passportNumber?.trim()) traveller.pNum = t.passportNumber.trim();
    if (t.passportNationality?.trim()) traveller.pNat = t.passportNationality.trim().toUpperCase();
    if (t.passportIssueDate?.trim()) traveller.pid = t.passportIssueDate.trim();
    if (t.passportExpiryDate?.trim()) traveller.eD = t.passportExpiryDate.trim();

    // H-7 / H-8 — document id and PAN, previously never transmitted.
    if (t.documentId?.trim()) traveller.di = t.documentId.trim();
    if (t.pan?.trim()) traveller.pan = t.pan.trim().toUpperCase();

    if (t.ssrSeatInfos?.length) traveller.ssrSeatInfos = t.ssrSeatInfos;
    if (t.ssrMealInfos?.length) traveller.ssrMealInfos = t.ssrMealInfos;
    if (t.ssrBaggageInfos?.length) traveller.ssrBaggageInfos = t.ssrBaggageInfos;
    if (t.ssrExtraServiceInfos?.length) traveller.ssrExtraServiceInfos = t.ssrExtraServiceInfos;

    return traveller;
}

export function mapToTripjackBooking(
    payload: FrontendBookingPayload
): TripjackBookingPayload {
    const result: TripjackBookingPayload = {
        bookingId: payload.bookingId,

        deliveryInfo: {
            emails: [payload.email],
            contacts: [payload.phone],
        },

        travellerInfo: payload.travellers.map(mapTraveller),
    };

    if (!payload.isHold) {
        result.paymentInfos = [{ amount: payload.amount }];
    }

    if (payload.emergencyContact) {
        result.contactInfo = {
            emails: [payload.emergencyContact.email],
            contacts: [payload.emergencyContact.phone],
            ecn: payload.emergencyContact.name,
        };
    }
    if (payload.gstInfo) {
        const gstInfo: any = {
            gstNumber: payload.gstInfo.gstNumber,
            registeredName: payload.gstInfo.registeredName,
        };

        if (payload.gstInfo.email?.trim()) gstInfo.email = payload.gstInfo.email.trim();
        if (payload.gstInfo.mobile?.trim()) gstInfo.mobile = payload.gstInfo.mobile.trim();
        if (payload.gstInfo.address?.trim()) gstInfo.address = payload.gstInfo.address.trim();

        result.gstInfo = gstInfo;
    }

    return result;
}