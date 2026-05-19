import { FlightDocumentRepository } from "../repositories/flight-client-template.repository";

export class FlightDocumentService {
    private repo = new FlightDocumentRepository();

    async getDocumentHtml(bookingId: string): Promise<any> {
        // Returns the dynamic mapped data from Tripjack
        const data = await this.repo.getBookingDocumentById(bookingId);
        return data;
    }
}

export default new FlightDocumentService();