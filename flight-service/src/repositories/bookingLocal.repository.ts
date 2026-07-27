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

    async getBookingByIdAndUser(bookingId: string, userId: string) {
        return await BookingModel.findOne({
            bookingId: bookingId,
            "userInfo.id": userId
        });
    }

    async getBookingByBookingId(bookingId: string) {
        return await BookingModel.findOne({
            bookingId: bookingId
        });
    }

    async getPendingStatusBookings() {
        const result = await BookingModel.find({
            status: {
                $nin: [
                    "SUCCESS",
                    "FAILED",
                    "CANCELLED",
                    "ABORTED",
                    // "UNCONFIRMED",
                    "REJECTED",
                    "INITIATED"
                ]
            }
        })
            .select({
                bookingId: 1,
                status: 1,
                _id: 0
            });

        return result;
    }

    async deleteExpiredInitiatedBookings() {

        /**
         * Current time
         */
        const now = new Date();

        /**
         * 24 hours before current time
         */
        const before24hr = new Date(
            now.getTime() - 24 * 60 * 60 * 1000
        );

        /**
         * Delete bookings
         */
        const result = await BookingModel.deleteMany({
            status: "INITIATED",
            createdAt: {
                $lte: before24hr
            }
        });

        return result.deletedCount;
    }

    async findBookingByEmail(email: string): Promise<Booking | null> {
        try {
            const booking = await BookingModel.findOne({ email: email });
            return booking;
        } catch (error) {
            console.error("Error finding booking by email:", error);
            throw new Error("Failed to find booking by email");
        }
    }

    async getBookingsByEmail(email: string) {
        try {
            const bookings = await BookingModel.find({
                email: { $regex: new RegExp(`^${email}$`, 'i') }
            });
            return bookings;
        } catch (error) {
            console.error("Error finding bookings by email:", error);
            throw new Error("Failed to find bookings by email");
        }
    }

    async getBookingsByUserId(userId: string) {
        return await BookingModel.find({
            "userInfo.id": userId
        }).sort({ createdAt: -1 });
    }

    async getBookingsByUserIdPaginated(query: any, skip: number, limit: number) {
        return await BookingModel.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    async countBookings(query: any) {
        return await BookingModel.countDocuments(query);
    }
}