import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { CancellationRequest } from "../models/tripjack.types";

class AmendmentService {
    async getCharges(bookingId: string, type: string) {
        if (!bookingId) throw { status: 400, message: "bookingId is required" };
        return await tripJackCabsProvider.getAmendmentCharges(bookingId, type || "CANCELLATION");
    }

    async processCancellation(payload: CancellationRequest) {
        if (!payload.bookingId) throw { status: 400, message: "bookingId is required for cancellation" };
        
        const finalPayload = {
            ...payload,
            amendmentType: "CANCELLATION" as const
        };
        
        const result = await tripJackCabsProvider.processAmendment(finalPayload);
        
        // If cancellation is successful at provider level, update our internal status
        if (result?.success || result?.data?.amendStatus === "SUCCESS") {
            try {
                await CabBookingModel.findOneAndUpdate(
                    { bookingId: payload.bookingId },
                    { status: CabBookingStatus.CANCELLED },
                    { new: true }
                );
                console.log(`✅ [AmendmentService] Updated status to CANCELLED for ${payload.bookingId}`);
            } catch (dbError) {
                console.error(`❌ [AmendmentService] Failed to update DB status for ${payload.bookingId}:`, dbError);
            }
        }
        
        return result;
    }
}

export const amendmentService = new AmendmentService();
