import { Schema } from "mongoose";

export const BusinessProfileSchema = new Schema(
    {
        businessName: {
            type: String,
            required: true,
            trim: true,
        },

        businessType: {
            type: String,
            required: true,
        },

        contactPerson: {
            type: String,
            required: true,
            trim: true,
        },

        businessEmail: {
            type: String,
            required: true,
            lowercase: true,
        },

        businessMobile: {
            type: String,
            required: true,
        },

        gstNumber: {
            type: String,
        },

        panNumber: {
            type: String,
        },

        address: {
            type: String,
            required: true,
        },

        city: {
            type: String,
            required: true,
        },

        country: {
            type: String,
            required: true,
        },
    },
    { _id: false }
);


// Used only for b2b & b2b2b.