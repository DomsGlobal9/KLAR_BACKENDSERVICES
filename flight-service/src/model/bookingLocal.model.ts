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

        ssrSeatInfos: [SSRSchema],
        ssrMealInfos: [SSRSchema],
        ssrBaggageInfos: [SSRSchema]
    },
    { _id: false }
);

const BookingSchema = new Schema<BookingDocument>(
    {
        bookingId: { type: String, required: true, unique: true },
        amount: Number,

        email: String,
        phone: String,

        isHold: Boolean,

        travellers: [TravellerSchema],

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
                "PENDING",
                "CONFIRMED",
                "FAILED",
                "CANCEL_REQUESTED",
                "CANCELLED"
            ],
            default: "INITIATED"
        },

        amendmentId: { type: String }
    },
    { timestamps: true }
);

export const BookingModel = mongoose.model<BookingDocument>(
    "Booking",
    BookingSchema
);