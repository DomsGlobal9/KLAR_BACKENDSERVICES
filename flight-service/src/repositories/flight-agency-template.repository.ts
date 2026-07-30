import BookingService from "../services/booking.service"; 
import { BookingRepository } from "./bookingLocal.repository"; // Importing your local database repository

export class FlightAgencyBookingRepository {
    // Instantiate your local MongoDB tracking repository to pull core billing states
    private localBookingRepo = new BookingRepository();

    async getAgencyBookingById(bookingId: string) {
        try {
            // 1. Concurrent Execution: Fetch data records simultaneously from Tripjack and local MongoDB
            const [tripjackDetails, localDbDetails] = await Promise.all([
                BookingService.getBookingDetails(bookingId),
                this.localBookingRepo.getBookingById(bookingId)
            ]);





            // 2. Validate existence of structural payload configurations
            if (!tripjackDetails) {
                throw new Error(`Flight structural information could not be retrieved from Tripjack for ID: ${bookingId}`);
            }

            // 3. Structural Payload Aggregator: Combine the live data with local billing variables
            const combinedAgencyPayload = {
                ...tripjackDetails, // Retains your exact deep structural layouts (order, itemInfos, AIR, etc.)
                bookingId: localDbDetails?.bookingId || tripjackDetails?.order?.BookingId || bookingId,
                totalPrice: localDbDetails?.totalPrice ?? tripjackDetails?.itemInfos?.AIR?.totalPriceInfo?.totalFareDetail?.FareComponents?.NetFare ?? 0,
                markupPrice: localDbDetails?.markupPrice ?? 0,
                tripjackPrice: localDbDetails?.tripjackPrice ?? tripjackDetails?.itemInfos?.AIR?.totalPriceInfo?.totalFareDetail?.FareComponents?.NetFare ?? 0,
                status: localDbDetails?.status || tripjackDetails?.order?.status || "PENDING"
            };

            console.log("Final Correlated Financial Object Metrics:", {
                bookingId: combinedAgencyPayload.bookingId,
                totalPrice: combinedAgencyPayload.totalPrice,
                markupPrice: combinedAgencyPayload.markupPrice,
                tripjackPrice: combinedAgencyPayload.tripjackPrice
            });

            return combinedAgencyPayload;

        } catch (error: any) {

            throw new Error(`Failed to correlate internal agency tracking variables: ${error.message}`);
        } 
    }
}