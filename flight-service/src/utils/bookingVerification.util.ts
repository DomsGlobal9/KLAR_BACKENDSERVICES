/**
 * Server-side authoritative amount and SSR verification (C-1, H-4).
 *
 * The browser is untrusted. Previously `paymentInfos[0].amount` was whatever
 * the client posted as `tripjackPrice`, so a tampered request could book a
 * real ticket for an arbitrary sum and the wallet was debited by the same
 * figure. Nothing compared it to the fare TripJack actually quoted.
 *
 * Flights 1.8.2 p. 49: "The amount sent in the Book Request should be Gross
 * Fare (TF from AirReviewResponse)"; p. 52 repeats it for `paymentInfos.amount`.
 * Error 1015 ("Total amount passed in payment doesn't match with total order
 * Amount") exists for exactly this mismatch.
 *
 * So the amount is rebuilt here from the stored Review:
 *     authoritative = Review TF  +  server-priced SSR selections
 * and the client's figure is only accepted if it matches. Selected SSRs are
 * re-priced from the Review / seat map rather than trusted, otherwise a paid
 * seat could be added for free (the SSR price feeds the same total).
 */

import { toPaise, paiseEqual, formatPaise } from "./money.util";

export class BookingVerificationError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;

    constructor(message: string, errorCode: string, statusCode = 400) {
        super(message);
        this.name = "BookingVerificationError";
        this.errorCode = errorCode;
        this.statusCode = statusCode;
    }
}

export interface SsrSelection {
    key: string;   // segment id
    code: string;  // supplier SSR code
}

export interface TravellerSsrSelections {
    ssrSeatInfos?: SsrSelection[];
    ssrMealInfos?: SsrSelection[];
    ssrBaggageInfos?: SsrSelection[];
}

/**
 * SSR entries survive TripjackFieldMapper with `code` renamed to `AirlineCode`
 * and `desc` to `Description`. Read both so this keeps working if the field
 * map changes.
 */
function ssrCodeOf(entry: any): string | undefined {
    return entry?.AirlineCode ?? entry?.code;
}

/** Every segment in the review, flattened, keyed by its SegmentID (mapped from `id`). */
function segmentsById(review: any): Map<string, any> {
    const out = new Map<string, any>();
    const trips = review?.TripInformation || review?.mappedData?.TripInformation || [];
    for (const trip of trips) {
        for (const seg of trip?.SegmentInformation || []) {
            const id = seg?.SegmentID ?? seg?.id;
            if (id !== undefined && id !== null) out.set(String(id), seg);
        }
    }
    return out;
}

/**
 * Seat map entries for a segment, from the stored seat-map response.
 * Shape: tripSeatMap.tripSeat[<segmentId>].sInfo[] (1.8.2 p. 46).
 */
function seatsForSegment(seatMap: any, segmentId: string): any[] {
    const tripSeat =
        seatMap?.tripSeatMap?.tripSeat ||
        seatMap?.data?.tripSeatMap?.tripSeat ||
        {};
    const entry = tripSeat?.[segmentId];
    if (!entry) return [];
    return entry.sInfo || entry.seatInfo || [];
}

/**
 * Look a selected SSR up in the authoritative source and return its price in
 * paise. Throws when the code was never offered for that segment.
 */
function priceSsr(
    kind: "SEAT" | "MEAL" | "BAGGAGE",
    selection: SsrSelection,
    review: any,
    seatMap: any,
    segments: Map<string, any>
): number {
    const segmentId = String(selection.key ?? "");
    const code = String(selection.code ?? "");

    if (!segmentId || !code) {
        throw new BookingVerificationError(
            `${kind} selection is missing a segment key or code.`,
            "SSR_MALFORMED"
        );
    }

    const segment = segments.get(segmentId);
    if (!segment && kind !== "SEAT") {
        throw new BookingVerificationError(
            `${kind} selected for segment ${segmentId}, which is not part of this booking.`,
            "SSR_UNKNOWN_SEGMENT"
        );
    }

    let candidates: any[];
    if (kind === "SEAT") {
        candidates = seatsForSegment(seatMap, segmentId);
        if (!candidates.length) {
            throw new BookingVerificationError(
                `No seat map available for segment ${segmentId}; seat ${code} cannot be verified.`,
                "SSR_SEATMAP_UNAVAILABLE"
            );
        }
    } else {
        candidates = segment?.ssrInfo?.[kind] || [];
    }

    const match = candidates.find((entry: any) => ssrCodeOf(entry) === code);
    if (!match) {
        throw new BookingVerificationError(
            `${kind} code "${code}" was not offered for segment ${segmentId}.`,
            "SSR_CODE_NOT_OFFERED"
        );
    }

    if (kind === "SEAT" && (match.isBooked === true)) {
        throw new BookingVerificationError(
            `Seat ${code} on segment ${segmentId} is already booked.`,
            "SSR_SEAT_UNAVAILABLE"
        );
    }

    // An absent amount means free — 1.8.2 p. 37 for meals, and connecting-segment
    // baggage carries no amount because it is priced on the first segment.
    const paise = toPaise(match.amount);
    return paise === null ? 0 : paise;
}

/**
 * Re-price every SSR the client selected, from the Review and seat map.
 * Returns the total in paise. Throws on any code that was not on offer.
 *
 * Baggage note (1.8.2 pp. 36-37): when a connecting-segment baggage entry has
 * no amount, whatever was selected on the first segment applies to the whole
 * journey. Such entries price to 0 here, which is exactly that behaviour — the
 * charge is carried by the priced segment.
 */
export function verifyAndPriceSsr(
    travellers: TravellerSsrSelections[],
    review: any,
    seatMap: any
): number {
    const segments = segmentsById(review);
    let totalPaise = 0;

    for (const traveller of travellers || []) {
        for (const sel of traveller?.ssrSeatInfos || []) {
            totalPaise += priceSsr("SEAT", sel, review, seatMap, segments);
        }
        for (const sel of traveller?.ssrMealInfos || []) {
            totalPaise += priceSsr("MEAL", sel, review, seatMap, segments);
        }
        for (const sel of traveller?.ssrBaggageInfos || []) {
            totalPaise += priceSsr("BAGGAGE", sel, review, seatMap, segments);
        }
    }

    return totalPaise;
}

/**
 * The reviewed total fare (TF) in paise — the figure TripJack expects in
 * `paymentInfos[0].amount` before ancillaries.
 *
 * Read from totalPriceInfo.totalFareDetail.FareComponents.TotalFare, which is
 * `fc.TF` after field mapping and already covers every traveller.
 */
export function reviewTotalFarePaise(review: any): number | null {
    const root = review?.mappedData || review;
    const tf =
        root?.totalPriceInfo?.totalFareDetail?.FareComponents?.TotalFare ??
        root?.totalPriceInfo?.totalFareDetail?.fc?.TF;
    return toPaise(tf);
}

export interface AmountVerificationInput {
    /** The amount the client wants sent to TripJack. */
    clientTripjackAmount: unknown;
    /** Stored authoritative review. */
    review: any;
    /** Stored seat map, if seats were selected. */
    seatMap?: any;
    /** Traveller SSR selections being booked. */
    travellers: TravellerSsrSelections[];
}

export interface AmountVerificationResult {
    /** What must be sent to TripJack, in rupees. */
    authoritativeAmount: number;
    authoritativePaise: number;
    baseFarePaise: number;
    ssrTotalPaise: number;
}

/**
 * Rebuild the payable amount from authoritative data and check the client's
 * figure against it.
 *
 * Rejects both directions: a lowered amount is the obvious attack, and an
 * inflated one silently overcharges the customer, so neither is tolerated
 * (C-1 requirements 12 and 13).
 */
export function verifyBookingAmount(
    input: AmountVerificationInput
): AmountVerificationResult {
    const { clientTripjackAmount, review, seatMap, travellers } = input;

    if (!review) {
        throw new BookingVerificationError(
            "No stored Review found for this booking; the fare cannot be verified.",
            "REVIEW_MISSING"
        );
    }

    const baseFarePaise = reviewTotalFarePaise(review);
    if (baseFarePaise === null || baseFarePaise <= 0) {
        throw new BookingVerificationError(
            "Stored Review does not contain a usable total fare.",
            "REVIEW_FARE_UNREADABLE"
        );
    }

    const ssrTotalPaise = verifyAndPriceSsr(travellers, review, seatMap);
    const authoritativePaise = baseFarePaise + ssrTotalPaise;

    const clientPaise = toPaise(clientTripjackAmount);
    if (clientPaise === null) {
        throw new BookingVerificationError(
            "Booking amount is missing or is not a valid number.",
            "AMOUNT_MALFORMED"
        );
    }

    if (!paiseEqual(clientPaise, authoritativePaise)) {
        throw new BookingVerificationError(
            `Booking amount does not match the reviewed fare. ` +
            `Expected ${formatPaise(authoritativePaise)}, received ${formatPaise(clientPaise)}. ` +
            `The fare may have changed — please review the itinerary again.`,
            "AMOUNT_MISMATCH"
        );
    }

    return {
        authoritativeAmount: authoritativePaise / 100,
        authoritativePaise,
        baseFarePaise,
        ssrTotalPaise,
    };
}
