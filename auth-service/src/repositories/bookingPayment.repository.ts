// import { Wallet } from "../models/wallet.model";
// import { WalletTransaction } from "../models/walletTransaction.model";
// import { Types } from "mongoose";

// export class BookingPaymentRepository {
//     static async getWallet(userId: Types.ObjectId) {
//         return Wallet.findOne({ userId });
//     }

//     static async checkExistingPayment(bookingId: string) {
//         return WalletTransaction.findOne({
//             referenceId: bookingId,
//             referenceType: "BOOKING",
//             direction: "DEBIT",
//         });
//     }

//     static async deductBalance(walletId: Types.ObjectId, totalPrice: number) {
//         const amount = totalPrice
//         return Wallet.findOneAndUpdate(
//             {
//                 _id: walletId,
//                 balance: { $gte: amount },
//             },
//             {
//                 $inc: { balance: -amount },
//             },
//             { new: true }
//         );
//     }

//     static async createTransaction(data: any) {
//         return WalletTransaction.create(data);
//     }
// }






































import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Types } from "mongoose";

export class BookingPaymentRepository {

    // Flexible finder to look up wallets by any property query block
    static async findWallet(query: object) {
        return Wallet.findOne(query);
    }

    static async getWallet(userId: Types.ObjectId) {
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
        const amount = totalPrice;
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
}