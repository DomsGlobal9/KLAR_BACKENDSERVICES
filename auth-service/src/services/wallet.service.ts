import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Types } from "mongoose";

export class WalletService {
    static async createWallet(userId: Types.ObjectId) {
        return Wallet.create({ userId });
    }

    static async getWallet(userId: Types.ObjectId, amount?: string) {
        const result = await Wallet.findOne({ userId });


        if (amount && result) {
            const amountValue = parseFloat(amount);

            if(!result || result.balance == null) {
                throw new Error("Wallet not found or balance is not available");
            }

            if (result.balance < amountValue) {
                throw new Error("Insufficient balance");
            }
        }

        return result;
    }

    static async credit(
        walletId: Types.ObjectId,
        userId: Types.ObjectId,
        amount: number,
        meta: any
    ) {
        await Wallet.findByIdAndUpdate(walletId, {
            $inc: { balance: amount },
        });

        return WalletTransaction.create({
            walletId,
            userId,
            type: meta.type,
            direction: "CREDIT",
            amount,
            paymentMethod: meta.paymentMethod,
            referenceType: meta.referenceType,
            referenceId: meta.referenceId,
            description: meta.description,
        });
    }

    static async debit(
        walletId: Types.ObjectId,
        userId: Types.ObjectId,
        amount: number,
        meta: any
    ) {
        const wallet = await Wallet.findById(walletId);

        if (!wallet) {
            throw new Error("Wallet not found");
        }

        if (wallet.balance == null) {
            throw new Error("Wallet balance is not available");
        }

        if (wallet.balance < amount) {
            throw new Error("Insufficient wallet balance");
        }

        wallet.balance -= amount;
        await wallet.save();

        return WalletTransaction.create({
            walletId,
            userId,
            type: meta.type,
            direction: "DEBIT",
            amount,
            paymentMethod: "WALLET",
            referenceType: meta.referenceType,
            referenceId: meta.referenceId,
            description: meta.description,
        });
    }
}
