// import { Types } from "mongoose";
// import { BookingPaymentRepository } from "../repositories/bookingPayment.repository";
// import { BadRequestError, NotFoundError } from "../errors/AppError";

// export class BookingPaymentService {

//     static async payForBooking(
//         userId: Types.ObjectId,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         /**
//          * Wallet fetch
//          */
//         const wallet = await BookingPaymentRepository.getWallet(userId);
//         if (!wallet) throw new NotFoundError("Wallet not found");

//         /**
//          * Idempotency check
//          */
//         const existing = await BookingPaymentRepository.checkExistingPayment(bookingId);
//         if (existing) {
//             return {
//                 transaction: existing,
//                 wallet,
//                 isDuplicate: true,
//             };
//         }

//         /**
//          * Atomic deduction
//          */
//         const updatedWallet = await BookingPaymentRepository.deductBalance(
//             wallet._id,
//             totalPrice
//         );

//         if (!updatedWallet) {
//             throw new BadRequestError(
//                 `Insufficient balance. Available: ${wallet.balance}`
//             );
//         }

//         /**
//          * Transaction entry
//          */
//         const transaction = await BookingPaymentRepository.createTransaction({
//             walletId: wallet._id,
//             userId,
//             type: "DEBIT",
//             direction: "DEBIT",
//             amount: totalPrice,
//             paymentMethod: "WALLET",
//             referenceType: "BOOKING",
//             referenceId: bookingId,
//             description: `Booking payment for ${bookingId}`,
//             status: "SUCCESS",
//         });

//         return {
//             transaction,
//             wallet: updatedWallet,
//             isDuplicate: false,
//         };
//     }
    
//     static async checkWalletBalance(
//         userId: Types.ObjectId,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         /**
//          * Get wallet
//          */
//         const wallet = await BookingPaymentRepository.getWallet(userId);
//         if (!wallet) {
//             throw new NotFoundError("Wallet not found");
//         }

//         /**
//          * Check if already paid for this booking
//          */
//         const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
//         const isAlreadyPaid = !!existingPayment;

//         const hasSufficientBalance = wallet.balance >= totalPrice;
//         const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - wallet.balance;

//         return {
//             hasSufficientBalance,
//             currentBalance: wallet.balance,
//             requiredAmount: totalPrice,
//             shortfallAmount,
//             bookingId,
//             isAlreadyPaid,
//         };
//     }
// }



























import { Types } from "mongoose";
import { BookingPaymentRepository } from "../repositories/bookingPayment.repository";
import { BadRequestError, NotFoundError } from "../errors/AppError";

export class BookingPaymentService {

    static async payForBooking(
        userId: Types.ObjectId,
        bookingId: string,
        totalPrice: number
    ) {
        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        const existing = await BookingPaymentRepository.checkExistingPayment(bookingId);
        if (existing) {
            return {
                transaction: existing,
                wallet,
                isDuplicate: true,
            };
        }

        const updatedWallet = await BookingPaymentRepository.deductBalance(
            wallet._id,
            totalPrice
        );

        if (!updatedWallet) {
            throw new BadRequestError(
                `Insufficient balance. Available: ${wallet.balance}`
            );
        }

        const transaction = await BookingPaymentRepository.createTransaction({
            walletId: wallet._id,
            userId,
            type: "DEBIT",
            direction: "DEBIT",
            amount: totalPrice,
            paymentMethod: "WALLET",
            referenceType: "BOOKING",
            referenceId: bookingId,
            description: `Booking payment for ${bookingId}`,
            status: "SUCCESS",
        });

        return {
            transaction,
            wallet: updatedWallet,
            isDuplicate: false,
        };
    }
    
    static async checkWalletBalance(
        userId: Types.ObjectId,
        bookingId: string,
        totalPrice: number
    ) {
        // 1. Check for existing duplicate payment entry first
        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        if (existingPayment) {
            return {
                hasSufficientBalance: false,
                currentBalance: 0,
                requiredAmount: totalPrice,
                shortfallAmount: 0,
                bookingId,
                isAlreadyPaid: true,
                walletUsed: "NONE",
            };
        }

        // 2. Fetch the target wallet matching this user identity
        let activeWallet = await BookingPaymentRepository.getWallet(userId);

        if (!activeWallet) {
            throw new NotFoundError("Wallet configuration not found for this user context");
        }

        // 3. Evaluate balance criteria
        if (activeWallet.balance >= totalPrice) {
            return {
                hasSufficientBalance: true,
                currentBalance: activeWallet.balance,
                requiredAmount: totalPrice,
                shortfallAmount: 0,
                bookingId,
                isAlreadyPaid: false,
                walletUsed: "PRIMARY",
            };
        }

        // 4. Fallback checking: If primary wallet lacks funds, verify if a parent creator fallback wallet exists
        // (Assuming your hierarchical wallet schema marks relational sub-accounts or fallback fields)
        if ((activeWallet as any).createdBy || (activeWallet as any).parentWalletId) {
            const parentQuery = (activeWallet as any).createdBy 
                ? { userId: new Types.ObjectId((activeWallet as any).createdBy) }
                : { _id: new Types.ObjectId((activeWallet as any).parentWalletId) };

            const parentWallet = await BookingPaymentRepository.findWallet(parentQuery);

            if (parentWallet && parentWallet.balance >= totalPrice) {
                return {
                    hasSufficientBalance: true,
                    currentBalance: parentWallet.balance,
                    requiredAmount: totalPrice,
                    shortfallAmount: 0,
                    bookingId,
                    isAlreadyPaid: false,
                    walletUsed: "PARENT_FALLBACK",
                };
            }
        }

        // Default shortfall response if all paths fall short
        return {
            hasSufficientBalance: false,
            currentBalance: activeWallet.balance,
            requiredAmount: totalPrice,
            shortfallAmount: totalPrice - activeWallet.balance,
            bookingId,
            isAlreadyPaid: false,
            walletUsed: "INSUFFICIENT_FUNDS",
        };
    }
}