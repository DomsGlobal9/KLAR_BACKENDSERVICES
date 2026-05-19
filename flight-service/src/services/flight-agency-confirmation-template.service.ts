import { FlightAgencyBookingRepository } from "../repositories/flight-agency-confirmation-template.repository";

export class FlightAgencyBookingService {
    private repo = new FlightAgencyBookingRepository();

    async getAgencyConfirmationData(bookingId: string): Promise<any> {
        // Fetches combined fields from DB record alongside Tripjack items
        return await this.repo.getAgencyBookingById(bookingId);
    }
}

export default new FlightAgencyBookingService();