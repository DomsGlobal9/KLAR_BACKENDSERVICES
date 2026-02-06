import { Schema } from "mongoose";
import { VerificationStatus } from "../constants/verificationStatus";

export const VerificationSchema = new Schema(
    {
        status: {
            type: String,
            enum: Object.values(VerificationStatus),
            default: VerificationStatus.PENDING,
        },

        gstNumber: {
            type: String,
        },

        panNumber: {
            type: String,
        },

        address: {
            type: String,
        },

        city: {
            type: String,
        },

        country: {
            type: String,
        },

        verifiedAt: {
            type: Date,
        },

        remarks: {
            type: String,
        },
    },
    { _id: false }
);
