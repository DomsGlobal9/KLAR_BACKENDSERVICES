import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { FlightBookingRepository } from "../repositories/flight-confirmation-template.repository";

export class FlightBookingService {
    private repo = new FlightBookingRepository();

    // This is a method, not a standalone function
    async getConfirmationHtml(bookingId: string): Promise<any> {
        const data = await this.repo.getBookingById(bookingId);
        // Return the raw data here so the controller can pass it to the template/pdf logic
        return data;
    }
}

// Add this export
export default new FlightBookingService();