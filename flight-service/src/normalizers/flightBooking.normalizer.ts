import {
    SimpleFrontendBookingPayload,
    TripJackBookingPayload
} from "../types/flightBook.types";
import { verifyAndTransformTripJackBookingPayload } from "../utils/tripjackBookingVerifier";


/**
 * Converts Simple Frontend payload → Exact TripJack Booking Payload
 * Then runs full validation
 */
export function normalizeToTripJackBookingPayload(
    frontendPayload: SimpleFrontendBookingPayload,
    isInstantBook: boolean = true
): {
    success: boolean;
    tripJackPayload?: TripJackBookingPayload;
    errors: string[];
} {
    const result = verifyAndTransformTripJackBookingPayload(
        {
            bookingID: frontendPayload.bookingID,
            paymentAmount: frontendPayload.paymentAmount,
            travellers: frontendPayload.travellers,
            gstInfo: frontendPayload.gstInfo,
            deliveryEmails: frontendPayload.deliveryEmails,
            deliveryContacts: frontendPayload.deliveryContacts,
            emergencyContact: frontendPayload.emergencyContact,
        },
        isInstantBook
    );

    return {
        success: result.success,
        tripJackPayload: result.payload,
        errors: result.errors,
    };
}

export function createEmptyFrontendBookingPayload(): SimpleFrontendBookingPayload {
    return {
        bookingID: '',
        travellers: [],
        deliveryEmails: [],
        deliveryContacts: [],
    };
}