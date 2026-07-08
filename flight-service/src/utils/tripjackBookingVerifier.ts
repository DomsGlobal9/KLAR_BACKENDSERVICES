import { FrontendBookingPayload } from "../types/booking.types";
import {
    NAME_REGEX,
    PHONE_REGEX,
    GST_REGEX,
    PASSPORT_REGEX,
    PAX_TITLES
} from "../constants/booking.constants";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateBookingPayload(payload: FrontendBookingPayload) {
    
    if (!payload.bookingId) throw new Error("bookingId is required");

    if (!PHONE_REGEX.test(payload.phone)) {
        throw new Error("Invalid phone format");
    }

    if (!payload.email) throw new Error("Email is required");

    let adultCount = 0;
    let infantCount = 0;

    payload.travellers.forEach((t, index) => {
        if (!NAME_REGEX.test(t.firstName)) {
            throw new Error(`Invalid firstName at traveller ${index}`);
        }

        if (!NAME_REGEX.test(t.lastName)) {
            throw new Error(`Invalid lastName at traveller ${index}`);
        }

        if (!PAX_TITLES[t.paxType].includes(t.title as any)) {
            throw new Error(`Invalid title at traveller ${index}`);
        }

        if (t.dob && !DATE_REGEX.test(t.dob)) {
            throw new Error(`Invalid DOB at traveller ${index}`);
        }

        if (t.paxType === "ADULT") adultCount++;
        if (t.paxType === "INFANT") infantCount++;

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

        if (hasAnyPassport && !hasFullPassport) {
            throw new Error(`Incomplete passport at traveller ${index}`);
        }

        if (hasFullPassport) {
            if (!PASSPORT_REGEX.test(t.passportNumber!)) {
                throw new Error(`Invalid passport number at traveller ${index}`);
            }

            if (!DATE_REGEX.test(t.passportExpiryDate!)) {
                throw new Error(`Invalid passport expiry at traveller ${index}`);
            }
        }
    });

    if (infantCount > adultCount) {
        throw new Error("Infants cannot exceed adults");
    }

    // if (payload.gstInfo?.gstNumber) {
    //     if (!GST_REGEX.test(payload.gstInfo.gstNumber)) {
    //         throw new Error("Invalid GST");
    //     }
    // }

    if (payload.emergencyContact) {
        if (!PHONE_REGEX.test(payload.emergencyContact.phone)) {
            throw new Error("Invalid emergency phone");
        }
    }
}