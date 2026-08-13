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

    async getFromDb(id: string, ownerId?: string) {
        // Ownership scope is mandatory — without it any caller can read any
        // booking, PII included, by guessing an id (F-04).
        if (!ownerId) {
            throw { status: 401, message: "Caller identity is required to read a booking." };
        }

        const owned = { $or: [{ agentId: ownerId }, { userId: ownerId }] };
        let booking;

        // Check if the parameter matches a standard 24-character Mongoose ObjectId structure
        if (mongoose.Types.ObjectId.isValid(id)) {
            booking = await InsuranceBookingModel.findOne({ _id: id, ...owned }).lean();
        } else {
            // Fallback: Query using your custom indexed property string key instead
            booking = await InsuranceBookingModel.findOne({ bookingId: id, ...owned }).lean();
        }

        // Deliberately 404 rather than 403 — a booking the caller does not own
        // must not be distinguishable from one that does not exist.
        if (!booking) {
            throw { status: 404, message: `Insurance booking reference "${id}" not located in database.` };
        }
        
        return { status: true, statusCode: 200, body: booking };
    }
}

export const bookingDetailsService = new BookingDetailsService();
