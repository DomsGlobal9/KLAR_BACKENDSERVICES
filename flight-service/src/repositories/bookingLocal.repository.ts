import { BookingModel } from "../model/bookingLocal.model";
import { Booking } from "../types/bookingLocal.types";


export class BookingRepository {

    async createBooking(data: Booking) {
        return await BookingModel.create(data);
    }

    async getBookingById(bookingId: string) {
        return await BookingModel.findOne({ bookingId });
    }

    async updateBooking(bookingId: string, updateData: Partial<Booking>) {
        return await BookingModel.findOneAndUpdate(
            { bookingId },
            { $set: updateData },
            { new: true }
        );
    }

    async updateBookingStatus(
        bookingId: string,
        status: Booking["status"]
    ) {
        return await BookingModel.findOneAndUpdate(
            { bookingId },
            { status },
            { new: true }
        );
    }
}