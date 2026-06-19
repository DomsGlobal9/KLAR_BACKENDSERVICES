import { UserModel } from "../models/user.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Types } from "mongoose";

export class BookingPaymentRepository {
    static async getWallet(userId: Types.ObjectId) {
        console.log("@@@@@@@@@@@@@@@@ USER ID we got: ", userId)
        return Wallet.findOne({ userId });
    }

    static async checkExistingPayment(bookingId: string) {
        return WalletTransaction.findOne({
            referenceId: bookingId,
            referenceType: "BOOKING",
            direction: "DEBIT",
        });
    }

    static async deductBalance(walletId: Types.ObjectId, totalPrice: number) {
        const amount = totalPrice
        return Wallet.findOneAndUpdate(
            {
                _id: walletId,
                balance: { $gte: amount },
            },
            {
                $inc: { balance: -amount },
            },
            { new: true }
        );
    }

    static async createTransaction(data: any) {
        return WalletTransaction.create(data);
    }

    /**
     * Deduct balance allowing negative values
     */
    static async deductBalanceAllowNegative(
        walletId: Types.ObjectId,
        amount: number
    ) {
        const wallet = await Wallet.findByIdAndUpdate(
            walletId,
            {
                $inc: { balance: -amount },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );

        return wallet;
    }

    /**
     * Set exact balance (for negative balance scenario)
     */
    static async setBalance(
        walletId: Types.ObjectId,
        balance: number
    ) {
        const wallet = await Wallet.findByIdAndUpdate(
            walletId,
            {
                $set: {
                    balance: balance,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        return wallet;
    }

    /**
     * Add balance to wallet (for reimbursement)
     */
    static async addBalance(
        walletId: Types.ObjectId,
        amount: number
    ) {
        const wallet = await Wallet.findByIdAndUpdate(
            walletId,
            {
                $inc: { balance: amount },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );

        return wallet;
    }

    /**
     * Get user details including createdBy
     */
    static async getUserWithParent(userId: Types.ObjectId) {
        return await UserModel.findById(userId)
            .select('_id email mobile roles createdBy businessProfile')
            .lean();
    }
}