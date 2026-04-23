import { BookingRepository } from "../repositories/bookingLocal.repository";
import { Booking } from "../types/bookingLocal.types";

class BookingService {
    private bookingRepo = new BookingRepository();

    async createInitialBooking(data: Partial<Booking>) {
        if (!data.bookingId) {
            throw new Error("bookingId is required");
        }

        if (!data.travellers || data.travellers.length === 0) {
            throw new Error("At least one traveller is required");
        }

        const payload: Booking = {
            bookingId: data.bookingId,
            amount: 0,
            email: data.email || "",
            phone: data.phone || "",
            isHold: false,
            travellers: data.travellers,
            status: "INITIATED",
            ...(data.gstInfo && { gstInfo: data.gstInfo }),
            ...(data.emergencyContact && { emergencyContact: data.emergencyContact })
        };

        return await this.bookingRepo.createBooking(payload);
    }
}

export default new BookingService();