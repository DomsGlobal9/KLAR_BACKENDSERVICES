import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import { InsuranceBookingModel, InsuranceBookingStatus } from "../models/InsuranceBooking.model";

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
    async raise(payload: any) {
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }
        if (!payload.travellerKeys) {
            throw { status: 400, message: "travellerKeys is required." };
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


    async cancel(payload: any) {
        if (!payload.amendmentId) {
            throw { status: 400, message: "amendmentId is required." };
        }
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }

        const tjPayload = {
            ...payload,
            type: "INSURANCE_CANCELLATION",
        };

        // 1. Call TripJack Provider
        const result = await tripJackInsuranceProvider.confirmCancellation(tjPayload);

        // 2. Determine if the API call was successful
        // We look at TripJack's wrapper success flag
        const isApiSuccess = result?.status?.success === true;
        
        // Extract the specific item status (e.g., "REJECTED", "SUCCESS", "REQUESTED")
        const tjItemStatus = result?.amendmentItems?.[0]?.status || "";

        // 3. Prepare Database Update
        const dbUpdate: any = { 
            amendmentId: payload.amendmentId,
            // Sync the full raw response so we have the latest TripJack data in our DB
            tjBookingDetailsResponse: result 
        };

        // CHANGE: We update status to CANCELLED if the API call succeeded, 
        // OR if the item status is specifically SUCCESS.
        // If you want to mark it CANCELLED even on REJECTED (to match the UI), 
        // you can just check isApiSuccess.
        if (isApiSuccess || tjItemStatus === "SUCCESS") {
            dbUpdate.status = InsuranceBookingStatus.CANCELLED;
            dbUpdate.cancelledAt = new Date();
        }

        // 4. Update the Database and wait for it to finish
        try {
            await InsuranceBookingModel.findOneAndUpdate(
                { bookingId: payload.bookingId },
                dbUpdate,
                { new: true }
            );
            console.log(`[Insurance] DB Updated for ${payload.bookingId}. New Status: ${dbUpdate.status}`);
        } catch (dbErr) {
            console.error("[Insurance] DB Update Error:", dbErr);
        }

        return {
            status: true,
            statusCode: 200,
            cancellationStatus: tjItemStatus,
            body: result,
        };
    }



}

export const amendmentService = new AmendmentService();
