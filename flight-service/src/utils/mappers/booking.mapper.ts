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

    const hasAnyPassport =
        t.passportNumber ||
        t.passportNationality ||
        t.passportIssueDate ||
        t.passportExpiryDate;

    const hasFullPassport =
        t.passportNumber &&
        t.passportNationality &&
        t.passportIssueDate &&
        t.passportExpiryDate;

    if (hasFullPassport) {
        traveller.pNum = t.passportNumber!;
        traveller.pNat = t.passportNationality!;
        traveller.pid = t.passportIssueDate!;
        traveller.eD = t.passportExpiryDate!;
    }

    if (t.ssrSeatInfos?.length) traveller.ssrSeatInfos = t.ssrSeatInfos;
    if (t.ssrMealInfos?.length) traveller.ssrMealInfos = t.ssrMealInfos;
    if (t.ssrBaggageInfos?.length) traveller.ssrBaggageInfos = t.ssrBaggageInfos;

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
        result.gstInfo = {
            gstNumber: payload.gstInfo.gstNumber,
            registeredName: payload.gstInfo.registeredName,
            Email: payload.gstInfo.email,
            Mobile: payload.gstInfo.mobile,
            Address: payload.gstInfo.address,
        };
    }

    return result;
}