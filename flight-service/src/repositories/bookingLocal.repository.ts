import { BookingModel } from "../model/bookingLocal.model";
import { Booking } from "../types/bookingLocal.types";

export class BookingRepository {

    async createBooking(data: Booking) {
        return await BookingModel.create(data);
    }

    async getBookingById(bookingId: string) {
        return await BookingModel.findOne({ bookingId });
    }

    /**
     * Atomically claim a booking for an in-flight TripJack call (C-6).
     *
     * The filter and the write are one MongoDB operation, so of N concurrent
     * requests exactly one matches a bookable status and flips it — the rest
     * match nothing and get null. A read-then-write check would let two
     * requests both observe "INITIATED" and both proceed.
     *
     * Only INITIATED and FAILED are bookable: a booking already in progress,
     * successful, held or cancelled must never be re-sent.
     */
    async claimForBooking(bookingId: string) {
        return await BookingModel.findOneAndUpdate(
            { bookingId, status: { $in: ["INITIATED", "FAILED"] } },
            { $set: { status: "BOOKING_IN_PROGRESS", bookingStartedAt: new Date() } },
            { new: true }
        );
    }

    /**
     * Release a claim so a corrected request can retry.
     *
     * Only ever called when TripJack definitively refused the booking. After a
     * timeout or 5xx the outcome is unknown and the claim is deliberately kept,
     * so a retry cannot create a second ticket.
     */
    async releaseBookingClaim(bookingId: string, status: Booking["status"] = "INITIATED") {
        return await BookingModel.findOneAndUpdate(
            { bookingId, status: "BOOKING_IN_PROGRESS" },
            { $set: { status } },
            { new: true }
        );
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
        const now = new Date();
        const before24hr = new Date(
            now.getTime() - 24 * 60 * 60 * 1000
        );
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
            .sort({ departureDate: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    async countBookings(query: any) {
        return await BookingModel.countDocuments(query);
    }
}