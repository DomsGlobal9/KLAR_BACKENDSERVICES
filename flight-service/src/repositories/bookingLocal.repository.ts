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

    async updateAmendment(
        bookingId: string,
        amendmentId: string
    ) {
        return await BookingModel.findOneAndUpdate(
            { bookingId },
            { amendmentId, status: "CANCEL_REQUESTED" },
            { new: true }
        );
    }

    async updateTravellerSSR(
        bookingId: string,
        travellerId: string,
        updateData: any
    ) {
        return await BookingModel.findOneAndUpdate(
            {
                bookingId,
                "travellers.travellerId": travellerId
            },
            {
                $set: {
                    "travellers.$.ssrSeatInfos": updateData.ssrSeatInfos,
                    "travellers.$.ssrMealInfos": updateData.ssrMealInfos,
                    "travellers.$.ssrBaggageInfos": updateData.ssrBaggageInfos
                }
            },
            { new: true }
        );
    }

    async updatePrices(
        bookingId: string,
        priceData: any
    ) {
        return await BookingModel.findOneAndUpdate(
            { bookingId },
            { $set: priceData },
            { new: true }
        );
    }
}