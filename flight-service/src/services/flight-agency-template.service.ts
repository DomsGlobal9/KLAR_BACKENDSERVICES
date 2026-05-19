import { FlightAgencyBookingRepository } from "../repositories/flight-agency-template.repository";

export class FlightAgencyBookingService {
    private repo = new FlightAgencyBookingRepository();

    async getAgencyData(bookingId: string): Promise<any> {
        // Fetches combined fields from DB record alongside Tripjack items
        return await this.repo.getAgencyBookingById(bookingId);
    }
}

export default new FlightAgencyBookingService();