import { FrontendBookingPayload, FrontendTraveller } from "../types/booking.types";
import {
    NAME_REGEX,
    PHONE_REGEX,
    GST_REGEX,
    PASSPORT_REGEX,
    PAX_TITLES
} from "../constants/booking.constants";
import type { BookingRequirements } from "./reviewConditions.util";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * IATA field limits from the Book contract (Flights 1.8.2 p. 53):
 * registeredName max 35 characters, address max 70.
 */
const GST_NAME_MAX = 35;
const GST_ADDRESS_MAX = 70;

/** Passport nationality is an IATA 2-letter country code (1.8.2 p. 52). */
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

/** Standard Indian PAN: 5 letters, 4 digits, 1 letter. */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Passport must remain valid for 6 months beyond travel (error 1067). */
const PASSPORT_VALIDITY_MONTHS = 6;

export class BookingValidationError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;

    constructor(message: string, errorCode = "BOOKING_VALIDATION_FAILED", statusCode = 400) {
        super(message);
        this.name = "BookingValidationError";
        this.errorCode = errorCode;
        this.statusCode = statusCode;
    }
}

function fail(message: string, errorCode?: string): never {
    throw new BookingValidationError(message, errorCode);
}

/**
 * Requirements used when no Review conditions are available.
 *
 * Everything conditional resolves to "not required": TripJack only demands
 * these fields when it says so, and inventing a requirement blocks bookings
 * that would otherwise succeed. The booking path refuses to proceed without a
 * stored Review anyway (C-1), so this is a safety net rather than a live path.
 */
const NO_CONDITIONS: BookingRequirements = {
    passport: { required: false, expiryRequired: false, issueDateRequired: false },
    dob: { adult: false, child: false, infant: false },
    gst: { applicable: false, mandatory: false },
    emergencyContact: { required: false },
    documentId: { applicable: false, mandatory: false },
    pan: { applicable: false },
    seat: { applicable: false },
    hold: { allowed: false },
    session: { validSeconds: null, createdAt: null },
};

/** Whole months between two dates, used for the passport 6-month rule. */
function monthsBetween(from: Date, to: Date): number {
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months--;
    return months;
}

function parseDate(value: string): Date | null {
    if (!DATE_REGEX.test(value)) return null;
    const d = new Date(`${value}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
}

function dobRequiredFor(paxType: FrontendTraveller["paxType"], req: BookingRequirements): boolean {
    if (paxType === "ADULT") return req.dob.adult;
    if (paxType === "CHILD") return req.dob.child;
    return req.dob.infant;
}

/**
 * Validate the passport block for one traveller against the Review conditions.
 *
 * Previously all four passport fields were required together or the whole
 * block was silently dropped from the upstream payload — so a fare needing
 * only `pNum` (pm=true, pped/pid=false) had its passport removed and failed at
 * TripJack. Each field is now demanded independently, exactly as its own flag
 * dictates (H-6).
 */
function validatePassport(
    t: FrontendTraveller,
    index: number,
    req: BookingRequirements,
    departureDate?: string
): void {
    const label = `traveller ${index + 1}`;

    if (req.passport.required && !t.passportNumber?.trim()) {
        fail(`Passport number is required for ${label}.`, "PASSPORT_REQUIRED");
    }
    if (req.passport.expiryRequired && !t.passportExpiryDate?.trim()) {
        fail(`Passport expiry date is required for ${label}.`, "PASSPORT_EXPIRY_REQUIRED");
    }
    if (req.passport.issueDateRequired && !t.passportIssueDate?.trim()) {
        fail(`Passport issue date is required for ${label}.`, "PASSPORT_ISSUE_DATE_REQUIRED");
    }
    // Nationality has no dedicated flag; TripJack needs it whenever a passport
    // number is sent, so it is tied to the number rather than demanded alone.
    if (t.passportNumber?.trim() && !t.passportNationality?.trim()) {
        fail(`Passport nationality is required for ${label}.`, "PASSPORT_NATIONALITY_REQUIRED");
    }

    if (t.passportNumber?.trim() && !PASSPORT_REGEX.test(t.passportNumber.trim())) {
        fail(`Invalid passport number for ${label}.`, "PASSPORT_INVALID");
    }
    if (t.passportNationality?.trim() && !COUNTRY_CODE_REGEX.test(t.passportNationality.trim().toUpperCase())) {
        fail(`Passport nationality for ${label} must be a 2-letter IATA country code.`, "PASSPORT_NATIONALITY_INVALID");
    }

    const issue = t.passportIssueDate?.trim();
    const expiry = t.passportExpiryDate?.trim();

    if (issue && !parseDate(issue)) {
        fail(`Invalid passport issue date for ${label}. Use YYYY-MM-DD.`, "PASSPORT_ISSUE_DATE_INVALID");
    }
    if (expiry && !parseDate(expiry)) {
        fail(`Invalid passport expiry date for ${label}. Use YYYY-MM-DD.`, "PASSPORT_EXPIRY_INVALID");
    }

    const issueDate = issue ? parseDate(issue) : null;
    const expiryDate = expiry ? parseDate(expiry) : null;

    if (issueDate && expiryDate && expiryDate <= issueDate) {
        fail(`Passport expiry must be after the issue date for ${label}.`, "PASSPORT_DATES_INCONSISTENT");
    }

    const travel = departureDate ? parseDate(departureDate) : null;
    if (travel) {
        // Error 1068 — travel date cannot precede passport issue date.
        if (issueDate && travel < issueDate) {
            fail(
                `Travel date cannot be before the passport issue date for ${label}.`,
                "PASSPORT_ISSUED_AFTER_TRAVEL"
            );
        }
        // Error 1067 — passport must not expire within 6 months of travel.
        if (expiryDate && monthsBetween(travel, expiryDate) < PASSPORT_VALIDITY_MONTHS) {
            fail(
                `Passport for ${label} must be valid for at least ${PASSPORT_VALIDITY_MONTHS} months after the travel date.`,
                "PASSPORT_EXPIRES_TOO_SOON"
            );
        }
    }
}

/**
 * GST validation driven by the Review conditions rather than the fare name
 * (C-5). `igm` makes the block mandatory; `gstappl` allows it optionally. The
 * format check that used to sit here commented out is live again.
 */
function validateGst(payload: FrontendBookingPayload, req: BookingRequirements): void {
    const gst = payload.gstInfo;
    const hasAnyGst = !!(gst && (gst.gstNumber?.trim() || gst.registeredName?.trim()));

    if (req.gst.mandatory && !hasAnyGst) {
        fail("GST details are mandatory for this fare.", "GST_REQUIRED");
    }

    if (!hasAnyGst) return;

    // Anything supplied is validated, whether or not it was mandatory —
    // TripJack rejects malformed GST with error 805 either way.
    if (!gst!.gstNumber?.trim()) {
        fail("GST number is required when GST details are provided.", "GST_NUMBER_REQUIRED");
    }
    if (!GST_REGEX.test(gst!.gstNumber.trim().toUpperCase())) {
        fail("GST number must be 15 alphanumeric characters.", "GST_NUMBER_INVALID");
    }
    if (!gst!.registeredName?.trim()) {
        fail("GST registered name is required when GST details are provided.", "GST_NAME_REQUIRED");
    }
    if (gst!.registeredName.trim().length > GST_NAME_MAX) {
        fail(`GST registered name must be at most ${GST_NAME_MAX} characters.`, "GST_NAME_TOO_LONG");
    }
    if (gst!.address && gst!.address.trim().length > GST_ADDRESS_MAX) {
        fail(`GST address must be at most ${GST_ADDRESS_MAX} characters.`, "GST_ADDRESS_TOO_LONG");
    }

    // When TripJack marks GST mandatory it wants the full block, not just the
    // number and name (1.8.2 p. 32 — "Valid GST Number and Registered Name and
    // GST Address, GST mobile number has to be passed").
    if (req.gst.mandatory) {
        if (!gst!.address?.trim()) {
            fail("GST address is mandatory for this fare.", "GST_ADDRESS_REQUIRED");
        }
        if (!gst!.mobile?.trim()) {
            fail("GST mobile number is mandatory for this fare.", "GST_MOBILE_REQUIRED");
        }
    }
}

export interface ValidateBookingOptions {
    /** Resolved Review conditions. Omitted only where no Review is available. */
    requirements?: BookingRequirements;
    /** First segment departure date (YYYY-MM-DD), for passport date rules. */
    departureDate?: string;
}

/**
 * Validate a booking payload before it is mapped and sent to TripJack.
 *
 * Conditional requirements come from the Review conditions; only the rules the
 * contract states unconditionally are applied to every booking.
 */
export function validateBookingPayload(
    payload: FrontendBookingPayload,
    options: ValidateBookingOptions = {}
) {
    const req = options.requirements ?? NO_CONDITIONS;

    if (!payload.bookingId) fail("bookingId is required", "BOOKING_ID_REQUIRED");

    if (!PHONE_REGEX.test(payload.phone)) {
        fail("Invalid phone format", "PHONE_INVALID");
    }

    if (!payload.email) fail("Email is required", "EMAIL_REQUIRED");

    if (!payload.travellers?.length) {
        fail("At least one traveller is required", "TRAVELLERS_REQUIRED");
    }

    let adultCount = 0;
    let childCount = 0;
    let infantCount = 0;

    const seenNames = new Set<string>();

    payload.travellers.forEach((t, index) => {
        const label = `traveller ${index + 1}`;

        if (!NAME_REGEX.test(t.firstName)) {
            fail(`Invalid firstName at ${label}`, "FIRST_NAME_INVALID");
        }

        if (!NAME_REGEX.test(t.lastName)) {
            fail(`Invalid lastName at ${label}`, "LAST_NAME_INVALID");
        }

        // Error 1010 — any two passengers sharing a full name is rejected
        // upstream, so catch it before the booking call.
        const fullName = `${t.firstName.trim().toLowerCase()} ${t.lastName.trim().toLowerCase()}`;
        if (seenNames.has(fullName)) {
            fail("Two passengers cannot have the same name.", "DUPLICATE_PASSENGER_NAME");
        }
        seenNames.add(fullName);

        if (!PAX_TITLES[t.paxType]) {
            fail(`Invalid paxType at ${label}`, "PAX_TYPE_INVALID");
        }

        if (!PAX_TITLES[t.paxType].includes(t.title as any)) {
            fail(`Invalid title at ${label}`, "TITLE_INVALID");
        }

        if (t.dob && !DATE_REGEX.test(t.dob)) {
            fail(`Invalid DOB at ${label}`, "DOB_INVALID");
        }

        // DOB is demanded only where the Review says so (C-4).
        if (dobRequiredFor(t.paxType, req) && !t.dob?.trim()) {
            fail(`Date of birth is required for ${label}.`, "DOB_REQUIRED");
        }

        if (t.paxType === "ADULT") adultCount++;
        if (t.paxType === "CHILD") childCount++;
        if (t.paxType === "INFANT") infantCount++;

        validatePassport(t, index, req, options.departureDate);

        // H-7 — document id, for student / senior-citizen fares.
        if (req.documentId.mandatory && !t.documentId?.trim()) {
            fail(`Document ID is required for ${label}.`, "DOCUMENT_ID_REQUIRED");
        }

        // H-8 — PAN.
        if (t.pan?.trim() && !PAN_REGEX.test(t.pan.trim().toUpperCase())) {
            fail(`Invalid PAN for ${label}.`, "PAN_INVALID");
        }
    });

    // Errors 1001 / 1002 — infants and children may not outnumber adults.
    if (infantCount > adultCount) {
        fail("Infants cannot exceed adults", "INFANT_MORE_THAN_ADULT");
    }
    if (childCount > adultCount) {
        fail("Children cannot exceed adults", "CHILD_MORE_THAN_ADULT");
    }

    validateGst(payload, req);

    // Emergency contact — mandatory only when the Review sets `iecr`
    // (1.8.2 p. 50, Case 4). It used to be demanded of every booking.
    if (req.emergencyContact.required) {
        const ec = payload.emergencyContact;
        if (!ec?.name?.trim() || !ec?.email?.trim() || !ec?.phone?.trim()) {
            fail(
                "Emergency contact name, email and phone are required for this fare.",
                "EMERGENCY_CONTACT_REQUIRED"
            );
        }
    }

    if (payload.emergencyContact?.phone) {
        if (!PHONE_REGEX.test(payload.emergencyContact.phone)) {
            fail("Invalid emergency phone", "EMERGENCY_PHONE_INVALID");
        }
    }
}
