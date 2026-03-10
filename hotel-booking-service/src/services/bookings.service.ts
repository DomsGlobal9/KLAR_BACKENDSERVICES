import { BookingModel } from "../models/Booking.model";

class BookingsService {
    /**
     * Get all bookings from the database
     * In a real app, this would be filtered by user ID or email.
     */
    async getAllBookings() {
        try {
            return await BookingModel.find().sort({ createdAt: -1 });
        } catch (error: any) {
            console.error("Error fetching bookings:", error.message);
            throw error;
        }
    }

    /**
     * Get a specific booking by confirmation number or reservation ID
     */
    async getBookingById(id: string) {
        try {
            return await BookingModel.findOne({
                $or: [
                    { confirmationNumber: id },
                    { reservationId: id }
                ]
            });
        } catch (error: any) {
            console.error("Error fetching booking:", error.message);
            throw error;
        }
    }
}

export const bookingsService = new BookingsService();
