import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { FlightBookingRepository } from "../repositories/flight-booking.repository";

export class FlightBookingService {
    private repo = new FlightBookingRepository();

    async getConfirmationHtml(bookingId: string): Promise<string> {
        const data = await this.repo.getBookingById(bookingId);
        return flightBookingConfirmationTemplate(data);
    }
}