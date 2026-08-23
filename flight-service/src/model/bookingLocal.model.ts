import mongoose, { Schema, Document } from "mongoose";
import { Booking } from "../types/bookingLocal.types";

export interface BookingDocument extends Booking, Document { }

const SSRSchema = new Schema(
    {
        key: { type: String },
        code: { type: String }
    },
    { _id: false }
);

const TravellerSchema = new Schema(
    {
        travellerId: { type: String, required: true },
        title: String,
        paxType: { type: String, enum: ["ADULT", "CHILD", "INFANT"] },
        firstName: String,
        lastName: String,
        dob: String,
        passportNumber: String,
        passportNationality: String,
        passportIssueDate: String,
        passportExpiryDate: String,
        documentId: String,
        pan: String,
        ssrSeatInfos: [SSRSchema],
        ssrMealInfos: [SSRSchema],
        ssrBaggageInfos: [SSRSchema]
    },
    { _id: false }
);

const FlightSegmentSchema = new Schema(
    {
        departureDate: { type: String, required: true },
        departureTime: String,
        arrivalDate: String,
        arrivalTime: String,
        origin: String,
        destination: String,
        airline: String,
        flightNumber: String
    },
    { _id: false }
);

const BookingSchema = new Schema<BookingDocument>(
    {
        bookingId: {
            type: String,
            required: true,
            unique: true
        },
        amount: Number,
        tripjackPrice: Number,
        markupPrice: Number,
        totalPrice: Number,
        email: String,
        phone: String,
        isHold: Boolean,
        travellers: [TravellerSchema],
        flightSegments: [FlightSegmentSchema],
        departureDate: {
            type: String,
            required: true
        },
        gstInfo: {
            gstNumber: String,
            registeredName: String,
            email: String,
            mobile: String,
            address: String
        },
        emergencyContact: {
            email: String,
            phone: String,
            name: String
        },
        userInfo: {
            id: String,
            email: String,
            role: String,
            clientType: String
        },
        status: {
            type: String,
            enum: [
                "INITIATED",
                // Claimed by an in-flight booking attempt. Set atomically before
                // the TripJack call so a concurrent duplicate is refused (C-6).
                "BOOKING_IN_PROGRESS",
                "SUCCESS",
                "ON_HOLD",
                "CANCELLED",
                "FAILED",
                "PENDING",
                "ABORTED",
                "UNCONFIRMED",
                "REQUESTED",
                "REJECTED",
                "NO_SHOW",
                "VOIDED",
                "REISSUED",
                "CANCEL_REQUESTED",
                "CONFIRMED"
            ],
            default: "INITIATED"
        },
        amendmentId: { type: String },
        /** When the current booking attempt claimed this record (C-6). */
        bookingStartedAt: { type: Date },
        refundProcessed: {
            type: Boolean,
            default: false
        },
        refundPrice: {
            type: String,
            default: '0'
        },
        refundDate: {
            type: Date,
        },
    },
    { timestamps: true }
);

export const BookingModel = mongoose.model<BookingDocument>(
    "Booking",
    BookingSchema
);