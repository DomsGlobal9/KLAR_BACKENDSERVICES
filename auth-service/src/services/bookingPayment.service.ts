import { Types } from "mongoose";
import { BookingPaymentRepository } from "../repositories/bookingPayment.repository";
import { BadRequestError, NotFoundError } from "../errors/AppError";

export class BookingPaymentService {

    static async payForBooking(
        userId: Types.ObjectId,
        bookingId: string,
        totalPrice: number
    ) {
        /**
         * Wallet fetch
         */
        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        /**
         * Idempotency check
         */
        const existing = await BookingPaymentRepository.checkExistingPayment(bookingId);
        if (existing) {
            return {
                transaction: existing,
                wallet,
                isDuplicate: true,
            };
        }

        /**
         * Atomic deduction
         */
        const updatedWallet = await BookingPaymentRepository.deductBalance(
            wallet._id,
            totalPrice
        );

        if (!updatedWallet) {
            throw new BadRequestError(
                `Insufficient balance. Available: ${wallet.balance}`
            );
        }

        /**
         * Transaction entry
         */
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
        /**
         * Get wallet
         */
        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) {
            throw new NotFoundError("Wallet not found");
        }

        /**
         * Check if already paid for this booking
         */
        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        const hasSufficientBalance = wallet.balance >= totalPrice;
        const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - wallet.balance;

        return {
            hasSufficientBalance,
            currentBalance: wallet.balance,
            requiredAmount: totalPrice,
            shortfallAmount,
            bookingId,
            isAlreadyPaid,
        };
    }
}