// import { FlightBookingRepository } from "../repositories/flight-confirmation-template.repository";

// export class FlightBookingService {
//     private repo = new FlightBookingRepository();

//     async getConfirmationHtml(bookingId: string): Promise<any> {
//         // Fetch the full object from the repo
//         const data = await this.repo.getBookingById(bookingId);
//         return data; 
//     }
// }

// export default new FlightBookingService();  









import { FlightBookingRepository } from "../repositories/flight-confirmation-template.repository";

export class FlightBookingService {
    private repo = new FlightBookingRepository();

    async getConfirmationHtml(bookingId: string): Promise<any> {
        // Returns the dynamic mapped data from Tripjack
        const data = await this.repo.getBookingById(bookingId);
        return data;
    }
}

export default new FlightBookingService();