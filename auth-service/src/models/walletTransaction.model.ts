import { Schema, model, Types } from "mongoose";

const walletTransactionSchema = new Schema(
    {
        walletId: {
            type: Types.ObjectId,
            ref: "Wallet",
            required: true,
        },
        userId: {
            type: Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["TOP_UP", "DEBIT", "REFUND", "WITHDRAW"],
            required: true,
        },
        direction: {
            type: String,
            enum: ["CREDIT", "DEBIT"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ["SUCCESS", "FAILED", "PENDING"],
            default: "SUCCESS",
        },
        referenceType: String, // BOOKING / PAYMENT
        referenceId: String,
        paymentMethod: String, // UPI / NET_BANKING / WALLET
        description: String,
    },
    { timestamps: true }
);

export const WalletTransaction = model(
    "WalletTransaction",
    walletTransactionSchema
);
