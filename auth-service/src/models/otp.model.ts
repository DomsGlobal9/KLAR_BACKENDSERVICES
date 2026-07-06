import mongoose, { Schema, Document } from "mongoose";

export enum OTPType {
    SIGNUP = "SIGNUP",
    LOGIN = "LOGIN",
    PASSWORD_RESET = "PASSWORD_RESET",
    FORGOT_PASSWORD = "FORGOT_PASSWORD",
    GUEST_ACCESS = "GUEST_ACCESS",
}

export interface IOTP extends Document {
    email: string;
    otp: string;
    type: OTPType;

    expiresAt: Date;
    verified: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const OTPSchema = new Schema<IOTP>(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        otp: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            enum: Object.values(OTPType),
            required: true,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        verified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

/**
 * Automatically delete expired OTPs
 */
OTPSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

export const OTPModel = mongoose.model<IOTP>(
    "OTP",
    OTPSchema
);