import mongoose, { Schema, model, Types } from "mongoose";

export const WalletSchema = new Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 0,
        },
        lowBalanceAlert: {
            type: Number,
        },

        emailAlerts: {
            type: Boolean,
            default: true,
        },

        smsAlerts: {
            type: Boolean,
            default: false,
        },
        currency: {
            type: String,
            default: "INR",
        },
        status: {
            type: String,
            enum: ["ACTIVE", "BLOCKED"],
            default: "ACTIVE",
        },
    },
    { timestamps: true }
);

export const Wallet = model("Wallet", WalletSchema);

