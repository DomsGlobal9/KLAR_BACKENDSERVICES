import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import { InsuranceBookingModel, InsuranceBookingStatus } from "../models/InsuranceBooking.model";
import { assertOwnsBooking } from "./ownership";

class AmendmentService {

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
    async raise(payload: any, ownerId?: string) {
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }
        if (!payload.travellerKeys) {
            throw { status: 400, message: "travellerKeys is required." };
        }

        // Raising an amendment starts a cancellation against the supplier, so
        // the caller must own the policy.
        await assertOwnsBooking(payload.bookingId, ownerId);

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
    async cancel(payload: any, ownerId?: string) {
        if (!payload.amendmentId) {
            throw { status: 400, message: "amendmentId is required." };
        }
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }

        // Destructive: this cancels a real policy with the insurer. Ownership
        // is checked before anything reaches TripJack.
        await assertOwnsBooking(payload.bookingId, ownerId);

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
