import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { PaymentRequest } from "../models/tripjack.types";
import { CabBookingModel, CabBookingStatus } from "../models/CabBooking.model";

class OrderService {
    async getBookingDetails(bookingIds: string) {
        if (!bookingIds) throw { status: 400, message: "bookingIds query param is required (comma separated)" };
        return await tripJackCabsProvider.getBookingDetails(bookingIds);
    }

    async getUserBookings(userId: string) {
        if (!userId) throw { status: 400, message: "userId is required" };
        const now = new Date();
        // Return confirmed bookings where pickup is in the future
        return await CabBookingModel.find({
            userId,
            status: CabBookingStatus.CONFIRMED,
            pickupDate: { $gte: now }
        }).sort({ pickupDate: 1 }).lean();
    }

    async createPayment(payload: PaymentRequest) {
        if (!payload.bookingId || !payload.amount) {
            throw { status: 400, message: "bookingId and amount are required for payment" };
        }
        return await tripJackCabsProvider.createPayment(payload);
    }
}

export const orderService = new OrderService();
