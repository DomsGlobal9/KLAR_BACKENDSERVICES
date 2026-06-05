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




































import mongoose, { Types } from "mongoose";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";

export class BookingPaymentRepository {
    
    static async getUserDocumentById(userId: Types.ObjectId): Promise<any> {
        return mongoose.connection.db?.collection("users").findOne({ _id: userId });
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