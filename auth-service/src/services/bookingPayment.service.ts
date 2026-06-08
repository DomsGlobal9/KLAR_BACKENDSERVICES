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
import { UserModel } from "../models/user.model";

export class BookingPaymentService {

    // ************************************
    // Private Functions Begins Here
    // ************************************

    private static async handleRMBalanceCheck(
        userId: Types.ObjectId,
        user: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleRMBalanceCheck] Start - userId:", userId, "bookingId:", bookingId, "totalPrice:", totalPrice);

        const parentAdminId = user.createdBy;
        if (!parentAdminId) {
            throw new BadRequestError("RM is not associated with any B2B_ADMIN");
        }

        const parentAdmin = await UserModel.findById(parentAdminId);
        if (!parentAdmin) {
            throw new NotFoundError("Parent B2B_ADMIN not found");
        }

        const parentWallet = await BookingPaymentRepository.getWallet(parentAdminId);
        if (!parentWallet) throw new NotFoundError("Parent wallet not found");

        if (parentWallet.status !== "ACTIVE") {
            throw new BadRequestError("Parent wallet is not active");
        }

        if (parentWallet.balance == null) {
            throw new BadRequestError("Parent wallet balance is not available");
        }

        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        const hasSufficientBalance = parentWallet.balance >= totalPrice;
        const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - parentWallet.balance;

        console.log("[handleRMBalanceCheck] Result - hasSufficientBalance:", hasSufficientBalance, "currentBalance:", parentWallet.balance);

        return {
            hasSufficientBalance,
            currentBalance: parentWallet.balance,
            requiredAmount: totalPrice,
            shortfallAmount,
            bookingId,
            isAlreadyPaid,
        };
    }

    private static async handleB2BAdminBalanceCheck(
        userId: Types.ObjectId,
        user: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleB2BAdminBalanceCheck] Start - userId:", userId, "bookingId:", bookingId, "totalPrice:", totalPrice);

        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;
        console.log("[handleB2BAdminBalanceCheck] isSubCompany:", isSubCompany);

        if (isSubCompany) {
            return await this.handleSubCompanyBalanceCheck(userId, user, wallet, bookingId, totalPrice);
        } else {
            return await this.handleParentAdminBalanceCheck(userId, wallet, bookingId, totalPrice);
        }
    }

    private static async handleSubCompanyBalanceCheck(
        userId: Types.ObjectId,
        user: any,
        subCompanyWallet: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleSubCompanyBalanceCheck] Start - userId:", userId, "subCompanyBalance:", subCompanyWallet.balance, "totalPrice:", totalPrice);

        const parentAdminId = user.createdBy;
        const parentAdmin = await UserModel.findById(parentAdminId);

        if (!parentAdmin) {
            throw new NotFoundError("Parent B2B_ADMIN not found");
        }

        const parentWallet = await BookingPaymentRepository.getWallet(parentAdminId as Types.ObjectId);
        if (!parentWallet) throw new NotFoundError("Parent wallet not found");

        if (parentWallet.status !== "ACTIVE") {
            throw new BadRequestError("Parent wallet is not active");
        }

        if (subCompanyWallet.balance == null) {
            throw new BadRequestError("Sub-company wallet balance is not available");
        }

        if (parentWallet.balance == null) {
            throw new BadRequestError("Parent wallet balance is not available");
        }

        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        // Check if sub-company has sufficient balance on its own
        const hasSubCompanySufficientBalance = subCompanyWallet.balance >= totalPrice;
        console.log("[handleSubCompanyBalanceCheck] hasSubCompanySufficientBalance:", hasSubCompanySufficientBalance);

        if (hasSubCompanySufficientBalance) {
            console.log("[handleSubCompanyBalanceCheck] Sub-company has sufficient balance alone");
            return {
                hasSufficientBalance: true,
                currentBalance: subCompanyWallet.balance,
                requiredAmount: totalPrice,
                shortfallAmount: 0,
                bookingId,
                isAlreadyPaid,
            };
        }

        // Sub-company has 0 or negative balance, check parent wallet only
        const hasParentSufficientBalance = parentWallet.balance >= totalPrice;
        const shortfallAmount = hasParentSufficientBalance ? 0 : totalPrice - parentWallet.balance;

        console.log("[handleSubCompanyBalanceCheck] hasParentSufficientBalance:", hasParentSufficientBalance);

        return {
            hasSufficientBalance: hasParentSufficientBalance,
            currentBalance: subCompanyWallet.balance,
            requiredAmount: totalPrice,
            shortfallAmount: shortfallAmount,
            bookingId,
            isAlreadyPaid,
            hierarchicalDetails: {
                subCompanyBalance: subCompanyWallet.balance,
                parentBalance: parentWallet.balance,
                willRequireParentSupport: true,
                parentHasSufficientBalance: hasParentSufficientBalance,
            },
        };
    }

    private static async handleParentAdminBalanceCheck(
        userId: Types.ObjectId,
        wallet: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleParentAdminBalanceCheck] Start - userId:", userId, "balance:", wallet.balance, "totalPrice:", totalPrice);

        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        if (wallet.balance == null) {
            throw new BadRequestError("Wallet balance is not available");
        }

        const hasSufficientBalance = wallet.balance >= totalPrice;
        const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - wallet.balance;

        console.log("[handleParentAdminBalanceCheck] hasSufficientBalance:", hasSufficientBalance);

        return {
            hasSufficientBalance,
            currentBalance: wallet.balance,
            requiredAmount: totalPrice,
            shortfallAmount,
            bookingId,
            isAlreadyPaid,
        };
    }

    private static async handleRMPayment(
        userId: Types.ObjectId,
        user: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleRMPayment] Start - userId:", userId, "bookingId:", bookingId, "totalPrice:", totalPrice);

        const parentAdminId = user.createdBy;
        if (!parentAdminId) {
            throw new BadRequestError("RM is not associated with any B2B_ADMIN");
        }

        const parentAdmin = await UserModel.findById(parentAdminId);
        if (!parentAdmin) {
            throw new NotFoundError("Parent B2B_ADMIN not found");
        }

        const parentWallet = await BookingPaymentRepository.getWallet(parentAdminId);
        if (!parentWallet) throw new NotFoundError("Parent wallet not found");

        if (parentWallet.status !== "ACTIVE") {
            throw new BadRequestError("Parent wallet is not active");
        }

        if (parentWallet.balance == null) {
            throw new BadRequestError("Parent wallet balance is not available");
        }

        if (parentWallet.balance < totalPrice) {
            throw new BadRequestError(
                `Insufficient balance in parent admin wallet. Available: ${parentWallet.balance}`
            );
        }

        const updatedParentWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
            parentWallet._id,
            totalPrice
        );

        if (!updatedParentWallet) {
            throw new BadRequestError("Failed to deduct from parent wallet");
        }

        const transaction = await BookingPaymentRepository.createTransaction({
            walletId: parentWallet._id,
            userId: parentAdminId,
            type: "DEBIT",
            direction: "DEBIT",
            amount: totalPrice,
            paymentMethod: "WALLET",
            referenceType: "BOOKING",
            referenceId: bookingId,
            description: `Booking payment for ${bookingId} (paid by RM: ${userId})`,
            status: "SUCCESS",
        });

        console.log("[handleRMPayment] Payment successful - newBalance:", updatedParentWallet.balance);

        return {
            transaction: transaction,
            wallet: updatedParentWallet,
            isDuplicate: false,
        };
    }

    private static async handleB2BAdminPayment(
        userId: Types.ObjectId,
        user: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleB2BAdminPayment] Start - userId:", userId, "bookingId:", bookingId, "totalPrice:", totalPrice);

        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;
        console.log("[handleB2BAdminPayment] isSubCompany:", isSubCompany);

        if (isSubCompany) {
            return await this.handleSubCompanyPayment(userId, user, wallet, bookingId, totalPrice);
        } else {
            return await this.handleParentAdminPayment(userId, wallet, bookingId, totalPrice);
        }
    }

    private static async handleSubCompanyPayment(
        userId: Types.ObjectId,
        user: any,
        subCompanyWallet: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleSubCompanyPayment] Start - userId:", userId, "subCompanyBalance:", subCompanyWallet.balance, "totalPrice:", totalPrice);

        const parentAdminId = user.createdBy;
        const parentAdmin = await UserModel.findById(parentAdminId);

        if (!parentAdmin) {
            throw new NotFoundError("Parent B2B_ADMIN not found");
        }

        const parentWallet = await BookingPaymentRepository.getWallet(parentAdminId as Types.ObjectId);
        if (!parentWallet) throw new NotFoundError("Parent wallet not found");

        if (parentWallet.status !== "ACTIVE") {
            throw new BadRequestError("Parent wallet is not active");
        }

        if (subCompanyWallet.balance == null) {
            throw new BadRequestError("Sub-company wallet balance is not available");
        }

        if (parentWallet.balance == null) {
            throw new BadRequestError("Parent wallet balance is not available");
        }

        // Check if sub-company has sufficient balance
        const hasSufficientBalance = subCompanyWallet.balance >= totalPrice;
        console.log("[handleSubCompanyPayment] hasSufficientBalance:", hasSufficientBalance);

        if (hasSufficientBalance) {
            console.log("[handleSubCompanyPayment] Sub-company has sufficient balance, deducting only from sub-company");

            const updatedSubCompanyWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
                subCompanyWallet._id,
                totalPrice
            );

            if (!updatedSubCompanyWallet) {
                throw new BadRequestError("Failed to deduct from sub-company wallet");
            }

            const transaction = await BookingPaymentRepository.createTransaction({
                walletId: subCompanyWallet._id,
                userId: userId,
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
                transaction: transaction,
                wallet: updatedSubCompanyWallet,
                isDuplicate: false,
            };
        }

        // Sub-company has 0 or negative balance - deduct from parent only
        console.log("[handleSubCompanyPayment] Sub-company has 0 or negative balance, deducting from parent only");
        console.log("[handleSubCompanyPayment] Parent wallet balance:", parentWallet.balance);

        // Check if parent has enough balance
        if (parentWallet.balance < totalPrice) {
            throw new BadRequestError(
                `Insufficient balance in parent wallet. Available: ${parentWallet.balance}, Required: ${totalPrice}`
            );
        }

        // Deduct FULL amount from parent wallet
        const updatedParentWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
            parentWallet._id,
            totalPrice
        );

        if (!updatedParentWallet) {
            throw new BadRequestError("Failed to deduct from parent wallet");
        }

        const parentTransaction = await BookingPaymentRepository.createTransaction({
            walletId: parentWallet._id,
            userId: parentAdminId,
            type: "DEBIT",
            direction: "DEBIT",
            amount: totalPrice,
            paymentMethod: "WALLET",
            referenceType: "BOOKING",
            referenceId: bookingId,
            description: `Booking payment for ${bookingId} (paid by parent admin)`,
            status: "SUCCESS",
        });

        // Deduct same amount from sub-company (making it more negative)
        const updatedSubCompanyWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
            subCompanyWallet._id,
            totalPrice
        );

        if (!updatedSubCompanyWallet) {
            // Rollback parent transaction
            await BookingPaymentRepository.addBalance(parentWallet._id, totalPrice);
            throw new BadRequestError("Failed to deduct from sub-company wallet");
        }

        const subCompanyTransaction = await BookingPaymentRepository.createTransaction({
            walletId: subCompanyWallet._id,
            userId: userId,
            type: "DEBIT",
            direction: "DEBIT",
            amount: totalPrice,
            paymentMethod: "WALLET",
            referenceType: "BOOKING",
            referenceId: bookingId,
            description: `Booking payment for ${bookingId} (sub-company debt to parent)`,
            status: "SUCCESS",
        });

        console.log("[handleSubCompanyPayment] Payment successful - Parent newBalance:", updatedParentWallet.balance, "SubCompany newBalance:", updatedSubCompanyWallet.balance);

        return {
            transaction: parentTransaction,
            wallet: updatedParentWallet,
            isDuplicate: false,
            hierarchicalDetails: {
                subCompanyPreviousBalance: subCompanyWallet.balance,
                subCompanyDeducted: totalPrice,
                subCompanyNewBalance: updatedSubCompanyWallet.balance,
                parentPreviousBalance: parentWallet.balance,
                parentDeducted: totalPrice,
                parentNewBalance: updatedParentWallet.balance,
            },
        };
    }

    private static async handleParentAdminPayment(
        userId: Types.ObjectId,
        wallet: any,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[handleParentAdminPayment] Start - userId:", userId, "balance:", wallet.balance, "totalPrice:", totalPrice);

        const existing = await BookingPaymentRepository.checkExistingPayment(bookingId);
        if (existing) {
            console.log("[handleParentAdminPayment] Duplicate payment detected");
            return {
                transaction: existing,
                wallet: wallet,
                isDuplicate: true,
            };
        }

        const updatedWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
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

        console.log("[handleParentAdminPayment] Payment successful - newBalance:", updatedWallet.balance);

        return {
            transaction: transaction,
            wallet: updatedWallet,
            isDuplicate: false,
        };
    }

    // ************************************
    // Private Functions end Here
    // ************************************

    static async checkWalletBalance(
        userId: Types.ObjectId,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[checkWalletBalance] Start - userId:", userId, "bookingId:", bookingId, "totalPrice:", totalPrice);

        const user = await UserModel.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        const userRole = user.roles;
        console.log("[checkWalletBalance] userRole:", userRole);

        if (userRole === "RM") {
            return await this.handleRMBalanceCheck(userId, user, bookingId, totalPrice);
        }

        if (userRole === "B2B_ADMIN") {
            return await this.handleB2BAdminBalanceCheck(userId, user, bookingId, totalPrice);
        }

        // Fallback for other roles
        console.log("[checkWalletBalance] Fallback for other roles");
        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) {
            throw new NotFoundError("Wallet not found");
        }

        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        if (wallet.balance == null) {
            throw new BadRequestError("Wallet balance is not available");
        }

        const balance = wallet.balance;
        const hasSufficientBalance = balance >= totalPrice;
        const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - balance;

        console.log("[checkWalletBalance] Result - hasSufficientBalance:", hasSufficientBalance, "currentBalance:", balance);

        return {
            hasSufficientBalance,
            currentBalance: balance,
            requiredAmount: totalPrice,
            shortfallAmount,
            bookingId,
            isAlreadyPaid,
        };
    }

    static async payForBooking(
        userId: Types.ObjectId,
        userRole: string,
        bookingId: string,
        totalPrice: number
    ) {
        console.log("[payForBooking] Start - userId:", userId, "userRole:", userRole, "bookingId:", bookingId, "totalPrice:", totalPrice);

        const user = await UserModel.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        if (userRole === "RM") {
            return await this.handleRMPayment(userId, user, bookingId, totalPrice);
        }

        if (userRole === "B2B_ADMIN") {
            return await this.handleB2BAdminPayment(userId, user, bookingId, totalPrice);
        }

        throw new BadRequestError(`Unsupported role: ${userRole}`);
    }
}




















// import { Types } from "mongoose";
// import { BookingPaymentRepository } from "../repositories/bookingPayment.repository";
// import { BadRequestError, NotFoundError } from "../errors/AppError";
// import { UserModel } from "../models/user.model";

// export class BookingPaymentService {

//     // ************************************
//     // Private Functions Begins Here
//     // ************************************

//     private static async handleRMPayment(
//         userId: Types.ObjectId,
//         user: any,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         const parentAdminId = user.createdBy;
//         if (!parentAdminId) {
//             throw new BadRequestError("RM is not associated with any B2B_ADMIN");
//         }

//         const parentAdmin = await UserModel.findById(parentAdminId);
//         if (!parentAdmin) {
//             throw new NotFoundError("Parent B2B_ADMIN not found");
//         }

//         const parentWallet = await BookingPaymentRepository.getWallet(parentAdminId);
//         if (!parentWallet) throw new NotFoundError("Parent wallet not found");

//         if (parentWallet.status !== "ACTIVE") {
//             throw new BadRequestError("Parent wallet is not active");
//         }

//         if (parentWallet.balance == null) {
//             throw new BadRequestError("Parent wallet balance is not available");
//         }

//         if (parentWallet.balance < totalPrice) {
//             throw new BadRequestError(
//                 `Insufficient balance in parent admin wallet. Available: ${parentWallet.balance}`
//             );
//         }

//         const updatedParentWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
//             parentWallet._id,
//             totalPrice
//         );

//         if (!updatedParentWallet) {
//             throw new BadRequestError("Failed to deduct from parent wallet");
//         }

//         const transaction = await BookingPaymentRepository.createTransaction({
//             walletId: parentWallet._id,
//             userId: parentAdminId,
//             type: "DEBIT",
//             direction: "DEBIT",
//             amount: totalPrice,
//             paymentMethod: "WALLET",
//             referenceType: "BOOKING",
//             referenceId: bookingId,
//             description: `Booking payment for ${bookingId} (paid by RM: ${userId})`,
//             status: "SUCCESS",
//         });

//         return {
//             transaction: transaction,
//             wallet: updatedParentWallet,
//             isDuplicate: false,
//         };
//     }

//     private static async handleB2BAdminPayment(
//         userId: Types.ObjectId,
//         user: any,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         const wallet = await BookingPaymentRepository.getWallet(userId);

//         if (!wallet) throw new NotFoundError("Wallet not found");

//         const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;

//         if (isSubCompany) {
//             return await this.handleSubCompanyPayment(userId, user, wallet, bookingId, totalPrice);
//         } else {
//             return await this.handleParentAdminPayment(userId, wallet, bookingId, totalPrice);
//         }
//     }

//     private static async handleSubCompanyPayment(
//         userId: Types.ObjectId,
//         user: any,
//         subCompanyWallet: any,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         const parentAdminId = user.createdBy;
//         const parentAdmin = await UserModel.findById(parentAdminId);

//         if (!parentAdmin) {
//             throw new NotFoundError("Parent B2B_ADMIN not found");
//         }

//         const parentWallet = await BookingPaymentRepository.getWallet(parentAdminId as Types.ObjectId);
//         if (!parentWallet) throw new NotFoundError("Parent wallet not found");

//         if (parentWallet.status !== "ACTIVE") {
//             throw new BadRequestError("Parent wallet is not active");
//         }

//         if (subCompanyWallet.balance == null) {
//             throw new BadRequestError("Sub-company wallet balance is not available");
//         }

//         if (parentWallet.balance == null) {
//             throw new BadRequestError("Parent wallet balance is not available");
//         }

//         // Check if sub-company has sufficient balance
//         const hasSufficientBalance = subCompanyWallet.balance >= totalPrice;

//         if (hasSufficientBalance) {
//             // Simple deduction from sub-company only
//             const updatedSubCompanyWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
//                 subCompanyWallet._id,
//                 totalPrice
//             );

//             if (!updatedSubCompanyWallet) {
//                 throw new BadRequestError("Failed to deduct from sub-company wallet");
//             }

//             const transaction = await BookingPaymentRepository.createTransaction({
//                 walletId: subCompanyWallet._id,
//                 userId: userId,
//                 type: "DEBIT",
//                 direction: "DEBIT",
//                 amount: totalPrice,
//                 paymentMethod: "WALLET",
//                 referenceType: "BOOKING",
//                 referenceId: bookingId,
//                 description: `Booking payment for ${bookingId}`,
//                 status: "SUCCESS",
//             });

//             return {
//                 transaction: transaction,
//                 wallet: updatedSubCompanyWallet,
//                 isDuplicate: false,
//             };
//         }

//         // Insufficient balance - need parent intervention with negative balance for sub-company
//         const subCompanyBalance = subCompanyWallet.balance;
//         const remainingAmount = totalPrice - subCompanyBalance;

//         // Check if parent has enough balance for the remaining amount
//         if (parentWallet.balance < remainingAmount) {
//             throw new BadRequestError(
//                 `Insufficient combined balance. Sub-company has: ${subCompanyBalance}, ` +
//                 `Parent has: ${parentWallet.balance}. Need: ${totalPrice}`
//             );
//         }

//         // Step 1: Deduct FULL amount from parent wallet
//         const updatedParentWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
//             parentWallet._id,
//             totalPrice
//         );

//         if (!updatedParentWallet) {
//             throw new BadRequestError("Failed to deduct from parent wallet");
//         }

//         const parentTransaction = await BookingPaymentRepository.createTransaction({
//             walletId: parentWallet._id,
//             userId: parentAdminId,
//             type: "DEBIT",
//             direction: "DEBIT",
//             amount: totalPrice,
//             paymentMethod: "WALLET",
//             referenceType: "BOOKING",
//             referenceId: bookingId,
//             description: `Booking payment for ${bookingId} (parent covering full amount)`,
//             status: "SUCCESS",
//         });

//         // Step 2: Deduct sub-company's ENTIRE balance (will go to negative if not enough)
//         const updatedSubCompanyWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
//             subCompanyWallet._id,
//             subCompanyBalance
//         );

//         if (!updatedSubCompanyWallet) {
//             // Rollback parent transaction
//             await BookingPaymentRepository.addBalance(parentWallet._id, totalPrice);
//             throw new BadRequestError("Failed to deduct from sub-company wallet");
//         }

//         const subCompanyTransaction = await BookingPaymentRepository.createTransaction({
//             walletId: subCompanyWallet._id,
//             userId: userId,
//             type: "DEBIT",
//             direction: "DEBIT",
//             amount: subCompanyBalance,
//             paymentMethod: "WALLET",
//             referenceType: "BOOKING",
//             referenceId: bookingId,
//             description: `Booking payment for ${bookingId} (sub-company entire balance deducted)`,
//             status: "SUCCESS",
//         });

//         // Step 3: Calculate negative balance for sub-company
//         const negativeBalance = subCompanyBalance - totalPrice;

//         // Step 4: Reimburse parent with sub-company's deducted amount
//         const reimbursedParentWallet = await BookingPaymentRepository.addBalance(
//             parentWallet._id,
//             subCompanyBalance
//         );

//         if (!reimbursedParentWallet) {
//             throw new BadRequestError("Failed to reimburse parent wallet");
//         }

//         const reimbursementTransaction = await BookingPaymentRepository.createTransaction({
//             walletId: parentWallet._id,
//             userId: parentAdminId,
//             type: "CREDIT",
//             direction: "CREDIT",
//             amount: subCompanyBalance,
//             paymentMethod: "WALLET",
//             referenceType: "REIMBURSEMENT",
//             referenceId: bookingId,
//             description: `Reimbursement from sub-company ${userId} for booking ${bookingId}`,
//             status: "SUCCESS",
//         });

//         // Step 5: Set negative balance on sub-company wallet
//         const finalSubCompanyWallet = await BookingPaymentRepository.setBalance(
//             subCompanyWallet._id,
//             negativeBalance
//         );

//         return {
//             transaction: parentTransaction,
//             wallet: reimbursedParentWallet,
//             isDuplicate: false,
//             hierarchicalDetails: {
//                 subCompanyPreviousBalance: subCompanyWallet.balance,
//                 subCompanyDeducted: subCompanyBalance,
//                 subCompanyNegativeBalance: negativeBalance,
//                 subCompanyCurrentBalance: negativeBalance,
//                 parentPreviousBalance: parentWallet.balance,
//                 parentDeducted: totalPrice,
//                 parentReimbursed: subCompanyBalance,
//                 parentNetDeducted: totalPrice - subCompanyBalance,
//                 parentCurrentBalance: reimbursedParentWallet.balance,
//             },
//         };
//     }

//     private static async handleParentAdminPayment(
//         userId: Types.ObjectId,
//         wallet: any,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         const existing = await BookingPaymentRepository.checkExistingPayment(bookingId);
//         if (existing) {
//             return {
//                 transaction: existing,
//                 wallet: wallet,
//                 isDuplicate: true,
//             };
//         }

//         const updatedWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
//             wallet._id,
//             totalPrice
//         );

//         if (!updatedWallet) {
//             throw new BadRequestError(
//                 `Insufficient balance. Available: ${wallet.balance}`
//             );
//         }

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
//             transaction: transaction,
//             wallet: updatedWallet,
//             isDuplicate: false,
//         };
//     }

//     // ************************************
//     // Private Functions end Here
//     // ************************************

//     static async checkWalletBalance(
//         userId: Types.ObjectId,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         const wallet = await BookingPaymentRepository.getWallet(userId);
//         if (!wallet) {
//             throw new NotFoundError("Wallet not found");
//         }

//         const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
//         const isAlreadyPaid = !!existingPayment;

//         if (wallet.balance == null) {
//             throw new BadRequestError("Wallet balance is not available");
//         }

//         const balance = wallet.balance;
//         const hasSufficientBalance = balance >= totalPrice;
//         const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - balance;

//         return {
//             hasSufficientBalance,
//             currentBalance: balance,
//             requiredAmount: totalPrice,
//             shortfallAmount,
//             bookingId,
//             isAlreadyPaid,
//         };
//     }

//     static async payForBooking(
//         userId: Types.ObjectId,
//         userRole: string,
//         bookingId: string,
//         totalPrice: number
//     ) {
//         const user = await UserModel.findById(userId);
//         if (!user) throw new NotFoundError("User not found");

//         if (userRole === "RM") {
//             return await this.handleRMPayment(userId, user, bookingId, totalPrice);
//         }

//         if (userRole === "B2B_ADMIN") {
//             return await this.handleB2BAdminPayment(userId, user, bookingId, totalPrice);
//         }

//         throw new BadRequestError(`Unsupported role: ${userRole}`);
//     }
// }