/**
 * Money handling for the flight booking path.
 *
 * Fares arrive from TripJack as JSON numbers (e.g. 5432.55). Comparing or
 * summing those with `===` or `+` produces classic float drift — 0.1 + 0.2
 * style — which on a money check means either rejecting a correct booking or
 * accepting a tampered one. Everything that is compared is therefore converted
 * to integer paise first and compared as integers (C-1, requirement 14).
 */

/** Rupees (number or numeric string) → integer paise. Returns null if not a finite number. */
export function toPaise(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    // Round rather than truncate: TripJack sends 2dp fares, and binary
    // representation of e.g. 730.00 can land a hair under the integer.
    return Math.round(n * 100);
}

/** Integer paise → rupees, 2dp, for sending upstream and persisting. */
export function fromPaise(paise: number): number {
    return Math.round(paise) / 100;
}

/**
 * Tolerance for an amount comparison, in paise.
 *
 * Zero would be ideal, but the fare we reconstruct is a sum of independently
 * rounded 2dp components, so a legitimate total can differ from the client's
 * by a single paise. One paise cannot be exploited and avoids rejecting
 * correct bookings.
 */
export const AMOUNT_TOLERANCE_PAISE = 1;

/** True when two paise amounts are equal within AMOUNT_TOLERANCE_PAISE. */
export function paiseEqual(a: number, b: number): boolean {
    return Math.abs(a - b) <= AMOUNT_TOLERANCE_PAISE;
}

/** Format paise for an error message, e.g. 543255 → "5432.55". */
export function formatPaise(paise: number): string {
    return fromPaise(paise).toFixed(2);
}
