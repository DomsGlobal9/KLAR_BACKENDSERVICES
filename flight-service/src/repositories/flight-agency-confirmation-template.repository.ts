import BookingService from "../services/booking.service";

export class FlightAgencyBookingRepository {
    async getAgencyBookingById(bookingId: string) {
        // 1. Fetch data from your database/Tripjack mapping service
        const response = await BookingService.getBookingDetails(bookingId);
        console.log("flight-agency-confirmation-template.repository.ts response:", JSON.stringify(response, null, 2));
        
        // This response object includes the fields: totalPrice, markupPrice, and tripjackPrice
        return response;
    }
}