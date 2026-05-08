import BookingService from "../services/booking.service";

export class FlightBookingRepository {
    async getBookingById(bookingId: string) {
        // Fetch dynamic data from the Tripjack API via your existing service
        const response = await BookingService.getBookingDetails(bookingId);
        console.log("79 flight-confirmation-template.repository.ts response from Tripjack API:", JSON.stringify(response, null, 2));
        // This 'response' is already mapped by TripjackFieldMapper.map
        return response;
    }
}