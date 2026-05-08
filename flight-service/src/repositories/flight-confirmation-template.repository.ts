export class FlightBookingRepository {
    async getBookingById(bookingId: string) {
        // In a real app: return await db.bookings.find({ bookingId });
        return {
            order: { BookingId: bookingId, status: "PENDING", NetFare: 10240.5 },
            // ... insert the rest of your JSON data here
        };
    }
}