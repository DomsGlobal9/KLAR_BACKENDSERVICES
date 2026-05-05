import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import { InsuranceBookingModel } from "../models/InsuranceBooking.model";

class BookingDetailsService {
    /**
     * Fetch insurance booking details from TripJack.
     * Also updates local DB record with the latest response.
     */
    async getDetails(bookingId: string) {
        if (!bookingId) {
            throw { status: 400, message: "bookingId is required." };
        }

        const result = await tripJackInsuranceProvider.bookingDetails(bookingId);
        
        // Optionally sync to DB (best-effort, non-blocking)
        InsuranceBookingModel.findOneAndUpdate(
            { bookingId },
            { tjBookingDetailsResponse: result },
            { new: true }
        ).catch(() => {}); // ignore DB errors silently

        return {
            status: true,
            statusCode: 200,
            body: result,
        };
    }

    /**
     * Get from local MongoDB by internal _id.
     */
    async getFromDb(id: string) {
        const booking = await InsuranceBookingModel.findById(id).lean();
        if (!booking) {
            throw { status: 404, message: `Insurance booking ${id} not found.` };
        }
        return { status: true, statusCode: 200, body: booking };
    }
}

export const bookingDetailsService = new BookingDetailsService();
