/**
 * IndiGo Upfront mandatory-seat errors from TripJack.
 *
 * TripJack enforces the Upfront seat rule at review, seat map, book and
 * fare-validate, and signals it with two error codes whose `details` are
 * prefixed `UPFRONT_SEAT_FAILURE$`:
 *
 *   12034  "Mandatory seat is not available for the selected fare type"
 *          — raised at Review and Seat Map when there are not enough free
 *            seats for the adult/child count, or the seat map lookup failed.
 *   8038   "Seat Selection is Mandatory"
 *          — raised at Book and fare-validate when a seat is missing, or a
 *            seat was taken between review and ticketing.
 *
 * Without this mapping both surface as an opaque upstream failure, which is
 * exactly the "generic booking failure" the change set out to remove. The
 * point is that the agent can act: pick another seat, or another fare.
 */

export const UPFRONT_SEAT_FAILURE_PREFIX = "UPFRONT_SEAT_FAILURE";

/** TripJack error codes that carry an Upfront seat failure. */
export const UPFRONT_SEAT_ERROR_CODES = new Set(["12034", "8038"]);

export interface UpfrontSeatError {
    errCode: string;
    /** TripJack's own message. */
    message: string;
    /** The part of `details` after the `UPFRONT_SEAT_FAILURE$` prefix. */
    reason: string;
    /** Message intended for the agent. */
    userMessage: string;
}

/** Every error object TripJack might have returned, from any of its shapes. */
function errorsOf(payload: any): any[] {
    const errors = payload?.errors ?? payload?.response?.data?.errors ?? payload?.data?.errors;
    return Array.isArray(errors) ? errors : [];
}

/**
 * Detect an Upfront seat failure in a TripJack response or error payload.
 * Returns null when this is some other failure.
 */
export function parseUpfrontSeatError(payload: any): UpfrontSeatError | null {
    for (const err of errorsOf(payload)) {
        const errCode = String(err?.errCode ?? "");
        const details = String(err?.details ?? "");
        const isUpfront =
            UPFRONT_SEAT_ERROR_CODES.has(errCode) ||
            details.startsWith(`${UPFRONT_SEAT_FAILURE_PREFIX}$`);

        if (!isUpfront) continue;

        const reason = details.startsWith(`${UPFRONT_SEAT_FAILURE_PREFIX}$`)
            ? details.slice(UPFRONT_SEAT_FAILURE_PREFIX.length + 1).trim()
            : details.trim();

        return {
            errCode: errCode || "8038",
            message: String(err?.message ?? "Seat Selection is Mandatory"),
            reason,
            userMessage: upfrontSeatUserMessage(errCode, reason),
        };
    }

    return null;
}

/**
 * Turn a TripJack Upfront failure into something the agent can act on.
 *
 * Kept deliberately close to TripJack's own wording — this maps their reason
 * onto an instruction, it does not invent a new rule.
 */
function upfrontSeatUserMessage(errCode: string, reason: string): string {
    const lower = reason.toLowerCase();

    if (lower.includes("insufficien")) {
        return (
            "This IndiGo Upfront fare requires a seat for every passenger, and there are not " +
            "enough seats available for your group. Please choose a different fare or flight."
        );
    }

    if (lower.includes("seat map")) {
        return (
            "Seat availability could not be confirmed for this IndiGo Upfront fare. " +
            "Please try again in a moment, or choose a different fare."
        );
    }

    if (errCode === "8038" || lower.includes("mandatory") || lower.includes("seat selection")) {
        return (
            "Seat selection is mandatory for this IndiGo Upfront fare. Please select a seat " +
            "for every adult and child passenger, then try again."
        );
    }

    return (
        "Seat selection is mandatory for this IndiGo Upfront fare and could not be completed. " +
        "Please select another seat or fare."
    );
}
