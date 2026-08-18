import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import { InsuranceBookingModel, InsuranceBookingStatus } from "../models/InsuranceBooking.model";

// Doc p. 51 / §4 p. 87: TripSafe can be cancelled up to 24 hours before the
// coverage start date. Enforced locally for a clear error instead of an
// opaque upstream rejection.
const CANCELLATION_CUTOFF_MS = 24 * 3600 * 1000;

class AmendmentService {

    /**
     * Load the local booking record and enforce ownership.
     *
     * Fail-open when the booking is not persisted locally (pre-persistence
     * bookings, DB outage) — TripJack remains the authority. When a record
     * exists and carries an owner, a different caller gets 404, matching the
     * F-04 doctrine: existence is never disclosed to a non-owner.
     */
    private async loadOwnedBooking(bookingId: string, callerId?: string | null) {
        const booking = await InsuranceBookingModel
            .findOne({ bookingId })
            .lean()
            .catch(() => null);
        if (!booking) return null;

        const owners = [booking.agentId, booking.userId].filter(Boolean);
        if (callerId && owners.length && !owners.includes(callerId)) {
            throw { status: 404, message: `Insurance booking "${bookingId}" not found.` };
        }
        return booking;
    }

    // ─── Raise Amendment ────────────────────────────────────────────────────

    /**
     * Raise a cancellation amendment (must be ≥ 24h before coverage start).
     * Returns amendmentId used in confirmCancellation.
     *
     * Payload: {
     *   amendmentId: "",          // leave empty string
     *   bookingId: "TJS...",
     *   type: "CANCELLATION",
     *   travellerKeys: { [planId]: { [productId]: [{ id }] } }
     * }
     */
    async raise(payload: any, callerId?: string | null) {
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }
        if (!payload.travellerKeys || typeof payload.travellerKeys !== "object" || !Object.keys(payload.travellerKeys).length) {
            throw { status: 400, message: "travellerKeys is required: { [planId]: { [productId]: [{ id }] } }." };
        }

        const booking = await this.loadOwnedBooking(payload.bookingId, callerId);

        // 24h cutoff — checked only when the coverage start is known locally.
        if (booking?.coverageStart) {
            const cutoff = new Date(booking.coverageStart).getTime() - CANCELLATION_CUTOFF_MS;
            if (Date.now() > cutoff) {
                throw {
                    status: 400,
                    message: "TripSafe cancellation must be raised at least 24 hours before the coverage start date.",
                };
            }
        }

        // Force correct type
        const tjPayload = {
            ...payload,
            amendmentId: payload.amendmentId || "",
            type: "CANCELLATION",
        };

        const result = await tripJackInsuranceProvider.raiseAmendment(tjPayload);

        // Store amendmentId in DB (best-effort)
        const amendmentId: string = result?.amendmentItems?.[0]?.amendmentId || "";
        if (amendmentId) {
            InsuranceBookingModel.findOneAndUpdate(
                { bookingId: payload.bookingId },
                { amendmentId }
            ).catch(() => {});
        }

        return {
            status: true,
            statusCode: 200,
            amendmentId,
            body: result,
        };
    }

    // ─── Confirm Cancellation ────────────────────────────────────────────────

    /**
     * Confirm cancellation using amendmentId from Raise response.
     *
     * Payload: {
     *   amendmentId: "...",
     *   bookingId: "TJS...",
     *   type: "INSURANCE_CANCELLATION",
     *   travellerKeys: { ... }
     * }
     */
    async cancel(payload: any, callerId?: string | null) {
        if (!payload.amendmentId) {
            throw { status: 400, message: "amendmentId is required." };
        }
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }

        await this.loadOwnedBooking(payload.bookingId, callerId);

        const tjPayload = {
            ...payload,
            type: "INSURANCE_CANCELLATION",
        };

        const result = await tripJackInsuranceProvider.confirmCancellation(tjPayload);

        const tjStatus: string = result?.amendmentItems?.[0]?.status || "";

        // Update DB
        const dbUpdate: any = { amendmentId: payload.amendmentId };
        if (tjStatus === "SUCCESS") {
            dbUpdate.status      = InsuranceBookingStatus.CANCELLED;
            dbUpdate.cancelledAt = new Date();
        }

        InsuranceBookingModel.findOneAndUpdate(
            { bookingId: payload.bookingId },
            dbUpdate
        ).catch(() => {});

        return {
            status: true,
            statusCode: 200,
            cancellationStatus: tjStatus,
            body: result,
        };
    }
}

export const amendmentService = new AmendmentService();
