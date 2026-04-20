import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { BookingRequest, EmbeddedBookingRequest } from "../models/tripjack.types";
import { env } from "../config/env";

class BookingService {
    private getAgentDetail() {
        return {
            agentId: Number(env.tripJack.agencyId) || 312879,
            agentEmail: "support@klar.com",
            agentPhone: "+911234567890"
        };
    }

    async book(payload: any) {
        if (!payload.journeyInfo || !payload.passengerDetail) {
            throw { status: 400, message: "Missing journeyInfo or passengerDetail" };
        }
        
        // quoteId / vehicleType live inside quotationInfo per TripJack doc
        if (!payload.quotationInfo?.quoteId && !payload.quotationInfo?.childQuoteId) {
            throw { status: 400, message: "quotationInfo.quoteId (or childQuoteId) is required for booking" };
        }

        const agent = this.getAgentDetail();

        const finalPayload: BookingRequest = {
            ...payload,
            agentId:    Number(payload.agentId    || agent.agentId),
            agentEmail: String(payload.agentEmail || agent.agentEmail),
            agentPhone: String(payload.agentPhone || agent.agentPhone),
            consent:    String(payload.consent    || "yes"),
            vendorId:   Number(payload.vendorId   || payload.quotationInfo?.vendorId)
        };

        console.log("[BookingService] Final Payload to TripJack:", JSON.stringify(finalPayload, null, 2));
        require('fs').writeFileSync('payload-debug.json', JSON.stringify(finalPayload, null, 2));

        return await tripJackCabsProvider.createBooking(finalPayload);
    }

    async embeddedBook(payload: EmbeddedBookingRequest) {
        if (!payload.sourceBookingId || !payload.bookingRequestList || !payload.bookingRequestList.length) {
            throw { status: 400, message: "Missing sourceBookingId or bookingRequestList" };
        }

        const agent = this.getAgentDetail();

        // Inject mandatory fields for each booking request in the list
        const processedList = payload.bookingRequestList.map(req => ({
            ...req,
            agentId:    req.agentId    || agent.agentId,
            agentEmail: req.agentEmail || agent.agentEmail,
            agentPhone: req.agentPhone || agent.agentPhone,
            consent:    req.consent    || "yes",
            vendorId:   req.vendorId   || req.quotationInfo?.vendorId
        }));

        const finalPayload: EmbeddedBookingRequest = {
            ...payload,
            bookingRequestList: processedList
        };

        return await tripJackCabsProvider.createEmbeddedBooking(finalPayload);
    }
}

export const bookingService = new BookingService();
