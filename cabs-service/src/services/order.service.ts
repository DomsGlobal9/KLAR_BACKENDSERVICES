import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { PaymentRequest } from "../models/tripjack.types";
import { CabBookingModel } from "../models/CabBooking.model";
import { cabBookingRepository } from "../repositories/cabBooking.repository";
import { Caller, ownsBooking } from "../utils/ownership.util";
import { StructuredError } from "./StructuredError";

class OrderService {
    async getBookingDetails(bookingIds: string, caller: Caller) {
        if (!bookingIds) throw { status: 400, message: "bookingIds query param is required (comma separated)" };

        // Ownership gate: only return supplier details for bookings the caller owns.
        // Without this, anyone with a bookingId could read another traveller's PII.
        const ids = bookingIds.split(",").map((s) => s.trim()).filter(Boolean);
        const bookings = await CabBookingModel.find({ 
            $or: [
                { klarBookingId: { $in: ids } },
                { bookingId: { $in: ids } }
            ]
        });
        const found = new Set(bookings.flatMap((b) => [b.klarBookingId, b.bookingId]));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) {
            throw new StructuredError("NOT_FOUND", `Booking(s) not found: ${missing.join(", ")}`);
        }
        const notOwned = bookings.filter((b) => !ownsBooking(b, caller));
        if (notOwned.length) {
            throw new StructuredError("FORBIDDEN", "You are not allowed to access one or more of these bookings.");
        }

        const providerBookingIds = bookings.map(b => b.bookingId).join(",");
        return await tripJackCabsProvider.getBookingDetails(providerBookingIds);
    }

    /**
     * Ungated supplier fetch for the invoice-PDF capability links (emailed to the
     * traveller/agent, who may not be logged in). Access control here is the
     * unguessability of the link, mirroring guest confirmation URLs — do NOT use
     * this for the JSON booking-details API.
     */
    async getBookingDetailsForInvoice(bookingIds: string) {
        if (!bookingIds) throw { status: 400, message: "bookingId is required" };
        return await tripJackCabsProvider.getBookingDetails(bookingIds);
    }

    async getUserBookings(userId: string) {
        if (!userId) throw { status: 400, message: "userId is required" };
        
        // Return all bookings for the user, newest first
        return await cabBookingRepository.getBookingsByUserId(userId);
    }

    async createPayment(payload: PaymentRequest) {
        if (!payload.bookingId || !payload.amount) {
            throw { status: 400, message: "bookingId and amount are required for payment" };
        }
        return await tripJackCabsProvider.createPayment(payload);
    }

    async checkEmailBookings(email: string): Promise<boolean> {
        const count = await CabBookingModel.countDocuments({
            "passenger.email": { $regex: new RegExp(`^${email}$`, "i") }
        });
        return count > 0;
    }
}

export const orderService = new OrderService();
