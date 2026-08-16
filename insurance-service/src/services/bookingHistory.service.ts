import { InsuranceBookingModel, InsuranceBookingStatus } from "../models/InsuranceBooking.model";

/**
 * Insurance booking history lookup by customer email, for the B2C guest
 * booking-history flow (email → OTP → history).
 *
 * The B2C portal gates its OTP on "does this email have any bookings?" and
 * previously asked only Hotel, Flight and Cab. A customer whose only purchase
 * was insurance was told "No bookings found" and could never reach the OTP
 * step, so their policies were unreachable.
 *
 * Two things make the email lookup non-obvious here, both verified against the
 * model rather than assumed:
 *
 * 1. `InsuranceBooking` has no first-class customer email column. The address
 *    the policy was sold to lives in `deliveryInfo.emails[]` inside the raw
 *    `tjBookPayload`, and each traveller carries their own `eid`. A
 *    `contactEmail` field is now written at book time so the common case is a
 *    single indexed equality match; the other two paths remain as a fallback
 *    so bookings made before that field existed are still found.
 *
 * 2. `agentName` is NOT a reliable customer email. For a B2C guest the auth
 *    middleware supplies `req.user.name = "B2C Guest"`, which wins over the
 *    delivery email in book.controller's fallback chain, so `agentName` holds
 *    a label rather than an address. It is deliberately not searched.
 */

/**
 * Statuses that count as a real booking for history purposes.
 *
 * FAILED is excluded: no policy was ever issued, so it must not make an email
 * "have bookings" and must not appear as history. CANCELLED is included — the
 * customer did buy it and legitimately wants to see it. PENDING is included
 * because the reconciliation sweep may still settle it.
 */
export const QUALIFYING_HISTORY_STATUSES: InsuranceBookingStatus[] = [
    InsuranceBookingStatus.SUCCESS,
    InsuranceBookingStatus.CANCELLED,
    InsuranceBookingStatus.PENDING,
];

/** Trim + lowercase, matching how auth-service stores the verified guest email. */
export function normalizeEmail(email: unknown): string {
    return String(email ?? "").trim().toLowerCase();
}

/** Same shape as the check used by flight's booking-history endpoint. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}

/** Escape regex metacharacters — an email is user input, never a pattern. */
function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a customer email across every place it can live on a booking.
 *
 * `contactEmail` is stored normalised so it compares by equality and uses its
 * index. The two legacy paths are case-insensitive because historical data was
 * written verbatim from the client.
 */
export function emailFilter(normalizedEmail: string) {
    const caseInsensitive = new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i");

    return {
        status: { $in: QUALIFYING_HISTORY_STATUSES },
        $or: [
            { contactEmail: normalizedEmail },
            { "travellers.eid": caseInsensitive },
            { "tjBookPayload.deliveryInfo.emails": caseInsensitive },
        ],
    };
}

/**
 * A booking summary for the history list.
 *
 * Only what the B2C booking-history UI renders. Traveller identities, passport
 * numbers, nominee details and the raw TripJack payloads are deliberately not
 * returned — the caller proved control of an email address, which is not a
 * reason to hand back every field on the record.
 */
/**
 * Per-traveller detail the booking-details modal renders.
 *
 * Deliberately narrower than the stored traveller: passport number (`pnum`),
 * nominee block (`ni`) and the student sponsor block (`sc`) are excluded —
 * none is displayed, and passport in particular has no business leaving the
 * service for a history view.
 */
export interface InsuranceHistoryTraveller {
    fn?: string;
    ln?: string;
    ti?: string;
    age?: number;
    gen?: string;
    dob?: string;
    /** Contact number. Distinct from `pnum`, which is the passport. */
    cnum?: string;
    eid?: string;
    policyId?: string;
}

export interface InsuranceBookingSummary {
    bookingId: string;
    status: string;
    journeyType?: string;
    planId?: string;
    productId?: string;
    coverageStart?: Date;
    coverageEnd?: Date;
    amount: number;
    currencyCode: string;
    travellerCount: number;
    /** The insured people — this is the customer's own booking. */
    travellers: InsuranceHistoryTraveller[];
    policyIds: string[];
    bookedOn?: Date;
    /** Alias of bookedOn; the details modal reads `createdAt`. */
    createdAt?: Date;
    cancelledAt?: Date;
}

function toSummary(booking: any): InsuranceBookingSummary {
    const travellers: any[] = Array.isArray(booking?.travellers) ? booking.travellers : [];

    return {
        bookingId: booking.bookingId,
        status: booking.status,
        journeyType: booking.journeyType,
        planId: booking.planId,
        productId: booking.productId,
        coverageStart: booking.coverageStart,
        coverageEnd: booking.coverageEnd,
        amount: booking.amount,
        currencyCode: booking.currencyCode || "INR",
        travellerCount: travellers.length,
        // The details modal lists the insured people, so the fields it renders
        // are returned — name, age, gender, DOB — plus the contact details and
        // policy id. Passport and nominee are held back.
        travellers: travellers.map((t) => ({
            fn: t?.fn,
            ln: t?.ln,
            ti: t?.ti,
            age: t?.age,
            gen: t?.gen,
            dob: t?.dob,
            cnum: t?.cnum,
            eid: t?.eid,
            policyId: t?.policyId,
        })),
        policyIds: travellers.map((t) => t?.policyId).filter(Boolean),
        bookedOn: booking.createdAt,
        createdAt: booking.createdAt,
        cancelledAt: booking.cancelledAt,
    };
}

class BookingHistoryService {
    /**
     * Whether this email has any qualifying insurance booking.
     *
     * Returns a bare boolean — this runs before OTP, so it must not leak how
     * many bookings exist, what they are, or anything about the customer.
     */
    async hasBookings(email: string): Promise<boolean> {
        const normalized = normalizeEmail(email);

        if (!normalized) {
            throw { status: 400, message: "Email is required." };
        }
        if (!isValidEmail(normalized)) {
            throw { status: 400, message: "Invalid email format." };
        }

        const count = await InsuranceBookingModel
            .countDocuments(emailFilter(normalized))
            .limit(1);

        return count > 0;
    }

    /**
     * Insurance bookings for a verified customer email.
     *
     * The caller must already have proved control of this address through the
     * existing guest OTP flow; the controller derives it from the verified
     * token rather than accepting it from the request.
     */
    async listByEmail(email: string, page = 1, limit = 20) {
        const normalized = normalizeEmail(email);

        if (!normalized || !isValidEmail(normalized)) {
            throw { status: 400, message: "A valid verified email is required." };
        }

        const safePage = Math.max(page || 1, 1);
        const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
        const skip = (safePage - 1) * safeLimit;

        const filter = emailFilter(normalized);

        const [bookings, total] = await Promise.all([
            InsuranceBookingModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean(),
            InsuranceBookingModel.countDocuments(filter),
        ]);

        return {
            status: true,
            statusCode: 200,
            body: {
                bookings: bookings.map(toSummary),
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total,
                    totalPages: Math.ceil(total / safeLimit),
                },
            },
        };
    }
}

export const bookingHistoryService = new BookingHistoryService();
