import { tripJackInsuranceClient } from "../clients/tripjack.client";

/**
 * Traveller/nominee identifiers that must never reach application logs.
 * Applied to every outbound payload log below — see redactForLog().
 */
const PII_KEYS = new Set([
    "dob", "fn", "ln", "eid", "pnum", "pnan", "cnum", "pincode", "gen", "ti",
    "ni", "nn", "nr", "sc", "sn", "sdob", "sr", "se", "emails", "contacts",
]);

/** JSON string of `payload` with every PII field replaced by a marker. */
export function redactForLog(payload: any): string {
    return JSON.stringify(payload, (key, value) =>
        PII_KEYS.has(key) ? "[REDACTED]" : value
    );
}

/**
 * TripJack TripSafe Insurance API Provider
 * Wraps all TripSafe endpoints per v6.0 documentation.
 * Base URL: https://apitest.tripjack.com (UAT) / https://tripjack.com (PROD)
 */
export class TripJackInsuranceProvider {

    // ─── Helper ────────────────────────────────────────────────────────────

    private normaliseError(error: any, label: string): never {
        const status  = error.response?.status || 500;
        const data    = error.response?.data;
        const message = data?.errors?.[0]?.message
            || data?.message
            || data?.description
            || error.message
            || label;

        console.error(`[TripSafe][${label}] HTTP ${status}:`, redactForLog(data || message));
        throw { response: { status, data: data || { message } } };
    }

    // ─── 1. Search ──────────────────────────────────────────────────────────

    /**
     * POST /insurance/v1/searchquery-list
     * Supports: Standalone, Student (ict=STUDENT), AMT (ict=AMT), Embedded (ict=API_EMB)
     */
    async search(payload: any): Promise<any> {
        try {
            console.log("[TripSafe] Search →", redactForLog(payload));
            const res = await tripJackInsuranceClient.post("/insurance/v1/searchquery-list", payload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "Search");
        }
    }

    // ─── 2. Review ──────────────────────────────────────────────────────────

    /**
     * POST /insurance/v1/review
     * Body: { pli: [{ plid, pi: [{ pid }] }] }
     * Returns: bid (bookingId) used in Book API
     */
    async review(payload: any): Promise<any> {
        try {
            console.log("[TripSafe] Review →", redactForLog(payload));
            const res = await tripJackInsuranceClient.post("/insurance/v1/review", payload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "Review");
        }
    }

    // ─── 3. Book ────────────────────────────────────────────────────────────

    /**
     * POST /oms/v1/insurance/book
     * Requires bookingId from Review, traveller ITI, paymentInfos, deliveryInfo
     */
    async book(payload: any): Promise<any> {
        try {
            console.log("[TripSafe] Book →", redactForLog(payload));
            const res = await tripJackInsuranceClient.post("/oms/v1/insurance/book", payload);

            // TripJack may return success:false in a 200 body
            const data = res.data;
            if (data?.status?.success === false) {
                const msg = data.errors?.[0]?.message || data.status?.description || "TripSafe Book failed";
                throw { response: { status: 400, data } };
            }
            return data;
        } catch (err: any) {
            if (err.response) throw err; // already normalised
            this.normaliseError(err, "Book");
        }
    }

    // ─── 4. Booking Details ─────────────────────────────────────────────────

    /**
     * POST /oms/v1/insurance/booking-details
     * Poll after booking to get final status (SUCCESS / CANCELLED / FAILED)
     */
    async bookingDetails(bookingId: string): Promise<any> {
        try {
            const res = await tripJackInsuranceClient.post("/oms/v1/insurance/booking-details", { bookingId });
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "BookingDetails");
        }
    }

    // ─── 5. Raise Amendment ─────────────────────────────────────────────────

    /**
     * POST /oms/v1/ins/amendment/raise
     * type: "CANCELLATION"
     * travellerKeys: { [planId]: { [productId]: [{ id }] } }
     */
    async raiseAmendment(payload: any): Promise<any> {
        try {
            console.log("[TripSafe] RaiseAmendment →", redactForLog(payload));
            const res = await tripJackInsuranceClient.post("/oms/v1/ins/amendment/raise", payload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "RaiseAmendment");
        }
    }

    // ─── 6. Confirm Cancellation ────────────────────────────────────────────

    /**
     * POST /oms/v1/ins/amendment/confirm-insurance-cancellation
     * type: "INSURANCE_CANCELLATION"
     * Uses amendmentId from Raise Amendment response
     */
    async confirmCancellation(payload: any): Promise<any> {
        try {
            console.log("[TripSafe] ConfirmCancellation →", redactForLog(payload));
            const res = await tripJackInsuranceClient.post(
                "/oms/v1/ins/amendment/confirm-insurance-cancellation",
                payload
            );
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "ConfirmCancellation");
        }
    }
}

export const tripJackInsuranceProvider = new TripJackInsuranceProvider();
