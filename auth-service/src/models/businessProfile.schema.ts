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

        gstRegisteredName: {
            type: String,
            trim: true,
        },

        gstEmail: {
            type: String,
            lowercase: true,
            trim: true,
        },

        gstMobile: {
            type: String,
            trim: true,
        },

        gstAddress: {
            type: String,
            trim: true,
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