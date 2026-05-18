import { FlightBookingRepository } from "../repositories/flight-confirmation-template.repository";
import BookingService from "./booking.service"; 

class AgencyFlightBookingService {
    private flightBookingRepository = new FlightBookingRepository();

    async getAgencyConfirmationData(bookingId: string) {
        // 1. Resolve transactional financial parameters from local MongoDB collection
        const mongoData = await this.flightBookingRepository.getBookingById(bookingId);
        
        // 2. Resolve native logistics details from Live Flight Supplier Engine via existing BookingService
        const tripjackData = await BookingService.getBookingDetails(bookingId);

        return {
            tripjackData,
            mongoData
        };
    }
}

export default new AgencyFlightBookingService();