import BookingService from "../services/booking.service";
import { BookingRepository } from "./bookingLocal.repository"; 

export class FlightBookingRepository {
    private localBookingRepo = new BookingRepository();

    async getBookingById(bookingId: string) {
        try {
            // 1. Fetch live Tripjack flight status and local DB records in parallel
            const [tripjackDetails, localDbDetails] = await Promise.all([
                BookingService.getBookingDetails(bookingId),
                this.localBookingRepo.getBookingById(bookingId)
            ]);

            console.log("--- DEBUG USER FLIGHT CONFIRMATION PIPELINE ---");
            console.log("Tripjack Response Found:", JSON.stringify(tripjackDetails));
            console.log("Local Database Record Found:", JSON.stringify(localDbDetails));

            if (!tripjackDetails) {
                throw new Error(`Flight booking details not found for ID: ${bookingId}`);
            }

            // 2. Extract the correct customer-facing total price
            const customerTotalPrice = localDbDetails?.totalPrice ?? 
                                       localDbDetails?.amount ?? 
                                       tripjackDetails?.itemInfos?.AIR?.totalPriceInfo?.totalFareDetail?.FareComponents?.NetFare ?? 
                                       0;

            // 3. Mutate Tripjack properties safely
            if (tripjackDetails.order) {
                tripjackDetails.order.Amount = customerTotalPrice;
            } else {
                tripjackDetails.order = { Amount: customerTotalPrice };
            }

            if (!tripjackDetails.itemInfos) tripjackDetails.itemInfos = {};
            if (!tripjackDetails.itemInfos.AIR) tripjackDetails.itemInfos.AIR = {};
            if (!tripjackDetails.itemInfos.AIR.totalPriceInfo) tripjackDetails.itemInfos.AIR.totalPriceInfo = {};
            if (!tripjackDetails.itemInfos.AIR.totalPriceInfo.totalFareDetail) tripjackDetails.itemInfos.AIR.totalPriceInfo.totalFareDetail = {};
            if (!tripjackDetails.itemInfos.AIR.totalPriceInfo.totalFareDetail.FareComponents) {
                tripjackDetails.itemInfos.AIR.totalPriceInfo.totalFareDetail.FareComponents = {};
            }

            tripjackDetails.itemInfos.AIR.totalPriceInfo.totalFareDetail.FareComponents.NetFare = customerTotalPrice;
            tripjackDetails.totalPrice = customerTotalPrice;

            // 4. FIXED compile crash: Cast localDbDetails as any to bypass Mongoose strict typings on the missing properties
            const finalMergedPayload = {
                ...tripjackDetails,
                travellers: localDbDetails?.travellers || [],
                pnr: (localDbDetails as any)?.pnr || (localDbDetails as any)?.pnrDetails || null
            };

            console.log(`Successfully mapped customer total price for PDF: ₹${customerTotalPrice}`);

            return finalMergedPayload;

        } catch (error: any) {
            console.error("Error in FlightBookingRepository map pipeline:", error.message);
            throw new Error(`Failed to build user flight confirmation payload: ${error.message}`);
        }
    }
}