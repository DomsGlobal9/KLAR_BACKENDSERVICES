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
        // 1. Fetch user document
        const userDoc = await BookingPaymentRepository.getUserDocumentById(userId);
        if (!userDoc) {
            throw new NotFoundError("User account document not found");
        }

        // 2. Check for duplicate payments
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

        // 3. Evaluate matching entity types
        const isChildCompany = userDoc.roles === "B2B_ADMIN" && userDoc.businessProfile && userDoc.createdBy;
        const isParentRM = userDoc.roles === "RM" && userDoc.createdBy;

        if (isChildCompany) {
            // --- CHILD COMPANY VALIDATION ---
            const childWallet = await BookingPaymentRepository.getWallet(userDoc._id);
            if (!childWallet) throw new NotFoundError("Child company wallet not found");

            // Option A: Child has enough funds
            if (childWallet.balance >= totalPrice) {
                return {
                    hasSufficientBalance: true,
                    currentBalance: childWallet.balance,
                    requiredAmount: totalPrice,
                    shortfallAmount: 0,
                    bookingId,
                    isAlreadyPaid: false,
                    walletUsed: "CHILD",
                };
            }

            // Option B: Fallback to Parent wallet
            const parentId = new Types.ObjectId(userDoc.createdBy);
            const parentWallet = await BookingPaymentRepository.getWallet(parentId);
            if (!parentWallet) throw new NotFoundError("Parent company wallet not found");

            if (parentWallet.balance >= totalPrice) {
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

            // Neither company has enough money -> Throw Error
            throw new BadRequestError(
                `Insufficient funds in both Child and Parent wallets. Total required: ${totalPrice}. Child Balance: ${childWallet.balance}, Parent Fallback Balance: ${parentWallet.balance}`
            );

        } else if (isParentRM) {
            // --- PARENT RM VALIDATION ---
            const parentCompanyId = new Types.ObjectId(userDoc.createdBy);
            const parentWallet = await BookingPaymentRepository.getWallet(parentCompanyId);
            if (!parentWallet) throw new NotFoundError("Parent company wallet not found for this RM");

            if (parentWallet.balance >= totalPrice) {
                return {
                    hasSufficientBalance: true,
                    currentBalance: parentWallet.balance,
                    requiredAmount: totalPrice,
                    shortfallAmount: 0,
                    bookingId,
                    isAlreadyPaid: false,
                    walletUsed: "PARENT",
                };
            }

            // Parent wallet lacks money -> Throw Error
            throw new BadRequestError(
                `Insufficient balance in Parent wallet for this RM booking. Required: ${totalPrice}, Available: ${parentWallet.balance}`
            );

        } else {
            // --- FALLBACK FOR PARENT ADMINS ---
            const standardWallet = await BookingPaymentRepository.getWallet(userDoc._id);
            if (!standardWallet) throw new NotFoundError("Wallet profile context not found");

            if (standardWallet.balance >= totalPrice) {
                return {
                    hasSufficientBalance: true,
                    currentBalance: standardWallet.balance,
                    requiredAmount: totalPrice,
                    shortfallAmount: 0,
                    bookingId,
                    isAlreadyPaid: false,
                    walletUsed: "PARENT_ADMIN",
                };
            }

            throw new BadRequestError(`Insufficient balance. Required: ${totalPrice}, Available: ${standardWallet.balance}`);
        }
    }
}