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
        return await tripJackCabsProvider.processAmendment(finalPayload);
    }
}

export const amendmentService = new AmendmentService();
