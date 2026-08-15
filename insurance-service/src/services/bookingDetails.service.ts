import mongoose from "mongoose";
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

    async getFromDb(id: string, ownerId?: string, isB2C: boolean = false) {
        if (!isB2C && !ownerId) {
            throw { status: 401, message: "Caller identity is required to read a booking." };
        }

        const query: any = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { bookingId: id };
        if (!isB2C && ownerId) {
            query.$or = [{ agentId: ownerId }, { userId: ownerId }];
        }

        const booking = await InsuranceBookingModel.findOne(query).lean();

        if (!booking) {
            throw { status: 404, message: `Insurance booking reference "${id}" not located in database.` };
        }
        
        return { status: true, statusCode: 200, body: booking };
    }
}

export const bookingDetailsService = new BookingDetailsService();
