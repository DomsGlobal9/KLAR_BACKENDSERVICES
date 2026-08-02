import { Types } from "mongoose";
import { BookingPaymentRepository } from "../repositories/bookingPayment.repository";
import { BadRequestError, NotFoundError } from "../errors/AppError";
import { UserModel } from "../models/user.model";
import { insufficientBalanceEmailTemplate, paymentSuccessEmailTemplate } from "../templates/walletNotification.templates";
import { EmailService } from "./email.service";

export class BookingPaymentService {


    /**
     * Private methods starts here
     */

    private static async handleRMBalanceCheck(
        userId: Types.ObjectId,
        user: any,
        bookingId: string,
        totalPrice: number
    ) {
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

        if (!hasSufficientBalance) {
            await this.sendInsufficientBalanceEmail(
                "RM",
                userId,
                bookingId,
                totalPrice,
                parentWallet.balance,
                shortfallAmount
            );
        }

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

        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;

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

        const hasSubCompanySufficientBalance = subCompanyWallet.balance >= totalPrice;

        // If sub-company has sufficient balance (positive and enough)
        if (hasSubCompanySufficientBalance) {
            const effectiveLimit = -(subCompanyWallet.limit);
            const newBalanceAfterDeduction = subCompanyWallet.balance - totalPrice;
            const wouldExceedLimit = newBalanceAfterDeduction < effectiveLimit;

            return {
                hasSufficientBalance: !wouldExceedLimit,
                currentBalance: subCompanyWallet.balance,
                requiredAmount: totalPrice,
                shortfallAmount: wouldExceedLimit ? (effectiveLimit - newBalanceAfterDeduction) : 0,
                bookingId,
                isAlreadyPaid,
                limitInfo: wouldExceedLimit ? {
                    limit: effectiveLimit,
                    wouldResultIn: newBalanceAfterDeduction,
                    message: `Payment would exceed wallet limit of ${effectiveLimit}`
                } : undefined
            };
        }

        // If sub-company has insufficient balance (including 0 or negative)
        // FIRST check if payment would exceed the limit
        const effectiveLimit = -(subCompanyWallet.limit);
        const newBalanceAfterDeduction = subCompanyWallet.balance - totalPrice;
        const wouldExceedLimit = newBalanceAfterDeduction < effectiveLimit;

        // If payment would exceed the limit, throw error immediately
        if (wouldExceedLimit) {
            throw new Error('Wallet limit exceed. Contact with parent company.')
            // throw new BadRequestError(
            //     `Payment would exceed wallet limit. Current balance: ${subCompanyWallet.balance}, ` +
            //     `Limit: ${effectiveLimit}, Attempted deduction: ${totalPrice}, ` +
            //     `Would result in: ${newBalanceAfterDeduction}`
            // );
        }

        // Only after confirming limit is not exceeded, check parent wallet
        const hasParentSufficientBalance = parentWallet.balance >= totalPrice;
        const shortfallAmount = hasParentSufficientBalance ? 0 : totalPrice - parentWallet.balance;

        if (!hasParentSufficientBalance) {
            await this.sendInsufficientBalanceEmail(
                "B2B_ADMIN",
                userId,
                bookingId,
                totalPrice,
                subCompanyWallet.balance,
                shortfallAmount
            );
        }

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
        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        if (wallet.balance == null) {
            throw new BadRequestError("Wallet balance is not available");
        }

        const hasSufficientBalance = wallet.balance >= totalPrice;
        const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - wallet.balance;

        if (!hasSufficientBalance) {
            await this.sendInsufficientBalanceEmail(
                "B2B_ADMIN",
                userId,
                bookingId,
                totalPrice,
                wallet.balance,
                shortfallAmount
            );
        }

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


        const newBalance = updatedParentWallet.balance ?? parentWallet.balance - totalPrice;

        await this.sendPaymentSuccessEmail(
            "RM",
            userId,
            bookingId,
            totalPrice,
            newBalance,
            "PARENT_WALLET"
        );

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

        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;

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


        const hasSufficientBalance = subCompanyWallet.balance >= totalPrice;

        if (!hasSufficientBalance) {
            const effectiveLimit = -(subCompanyWallet.limit);
            const newBalanceAfterDeduction = subCompanyWallet.balance - totalPrice;
            const wouldExceedLimit = newBalanceAfterDeduction < effectiveLimit;

            if (wouldExceedLimit) {
                throw new BadRequestError(
                    `Payment would exceed wallet limit. Current balance: ${subCompanyWallet.balance}, ` +
                    `Limit: ${effectiveLimit}, Attempted deduction: ${totalPrice}, ` +
                    `Would result in: ${newBalanceAfterDeduction}`
                );
            }
        }

        if (hasSufficientBalance) {

            const effectiveLimit = -(subCompanyWallet.limit);
            const newBalanceAfterDeduction = subCompanyWallet.balance - totalPrice;

            if (newBalanceAfterDeduction < effectiveLimit) {
                const shortfall = effectiveLimit - newBalanceAfterDeduction;
                throw new BadRequestError(
                    `Payment would exceed wallet limit. Current balance: ${subCompanyWallet.balance}, ` +
                    `Limit: ${effectiveLimit}, Attempted deduction: ${totalPrice}, ` +
                    `Would result in: ${newBalanceAfterDeduction} (Shortfall from limit: ${shortfall})`
                );
            }

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

            const newBalance = updatedSubCompanyWallet.balance ?? subCompanyWallet.balance - totalPrice;

            await this.sendPaymentSuccessEmail(
                "B2B_ADMIN",
                userId,
                bookingId,
                totalPrice,
                newBalance,
                "SUB_COMPANY_WALLET"
            );

            return {
                transaction: transaction,
                wallet: updatedSubCompanyWallet,
                isDuplicate: false,
            };
        }


        if (parentWallet.balance < totalPrice) {
            throw new BadRequestError(
                `Insufficient balance in parent wallet. Available: ${parentWallet.balance}, Required: ${totalPrice}`
            );
        }

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


        const updatedSubCompanyWallet = await BookingPaymentRepository.deductBalanceAllowNegative(
            subCompanyWallet._id,
            totalPrice
        );

        if (!updatedSubCompanyWallet) {

            await BookingPaymentRepository.addBalance(parentWallet._id, totalPrice);
            throw new BadRequestError("Failed to deduct from sub-company wallet");
        }

        const newParentBalance = updatedParentWallet.balance ?? parentWallet.balance - totalPrice;

        await this.sendPaymentSuccessEmail(
            "B2B_ADMIN",
            userId,
            bookingId,
            totalPrice,
            newParentBalance,
            "PARENT_WALLET"
        );

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
        const existing = await BookingPaymentRepository.checkExistingPayment(bookingId);
        if (existing) {
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

        const newBalance = updatedWallet.balance ?? wallet.balance - totalPrice;

        await this.sendPaymentSuccessEmail(
            "B2B_ADMIN",
            userId,
            bookingId,
            totalPrice,
            newBalance,
            "PARENT_WALLET"
        );

        return {
            transaction: transaction,
            wallet: updatedWallet,
            isDuplicate: false,
        };
    }

    private static async sendInsufficientBalanceEmail(
        userRole: string,
        userId: Types.ObjectId,
        bookingId: string,
        requiredAmount: number,
        currentBalance: number,
        shortfallAmount: number
    ) {
        try {
            const user = await UserModel.findById(userId).populate('createdBy');
            if (!user) return;

            if (userRole === "B2B_ADMIN" || userRole === "MASTER" || userRole === "USER" || userRole === "AGENT") {
                const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;

                if (isSubCompany) {
                    const subCompanyEmail = user.email;
                    const parentAdmin = await UserModel.findById(user.createdBy);

                    if (subCompanyEmail) {
                        const subCompanyHtml = insufficientBalanceEmailTemplate("SUB_COMPANY", {
                            bookingId,
                            requiredAmount,
                            currentBalance,
                            shortfallAmount,
                            companyName: user.businessProfile?.companyName,
                            parentCompanyName: parentAdmin?.businessProfile?.companyName
                        });
                        await EmailService.sendEmail({
                            to: subCompanyEmail,
                            subject: "Insufficient Wallet Balance Alert",
                            html: subCompanyHtml
                        });
                    }

                    if (parentAdmin?.email) {
                        const parentHtml = insufficientBalanceEmailTemplate("PARENT_ADMIN", {
                            bookingId,
                            requiredAmount,
                            currentBalance,
                            shortfallAmount,
                            companyName: parentAdmin.businessProfile?.companyName
                        });
                        await EmailService.sendEmail({
                            to: parentAdmin.email,
                            subject: "Insufficient Wallet Balance Alert - Sub-Company Payment",
                            html: parentHtml
                        });
                    }
                } else {
                    const parentHtml = insufficientBalanceEmailTemplate("PARENT_ADMIN", {
                        bookingId,
                        requiredAmount,
                        currentBalance,
                        shortfallAmount,
                        companyName: user.businessProfile?.companyName
                    });
                    await EmailService.sendEmail({
                        to: user.email,
                        subject: "Insufficient Wallet Balance Alert",
                        html: parentHtml
                    });
                }
            }
            else if (userRole === "RM") {
                const parentAdmin = await UserModel.findById(user.createdBy);
                if (parentAdmin?.email) {
                    const rmHtml = insufficientBalanceEmailTemplate("RM", {
                        bookingId,
                        requiredAmount,
                        currentBalance,
                        shortfallAmount,
                        companyName: parentAdmin.businessProfile?.companyName
                    });
                    await EmailService.sendEmail({
                        to: parentAdmin.email,
                        subject: "Insufficient Wallet Balance Alert - RM Payment",
                        html: rmHtml
                    });
                }
            }
        } catch (error) {

        }
    }

    private static async sendPaymentSuccessEmail(
        userRole: string,
        userId: Types.ObjectId,
        bookingId: string,
        amount: number,
        newBalance: number,
        paymentSource: string
    ) {
        console.log("[sendPaymentSuccessEmail] Called with:", {
            userRole,
            userId: userId.toString(),
            bookingId,
            amount,
            amountType: typeof amount,
            newBalance,
            newBalanceType: typeof newBalance,
            paymentSource
        });

        try {
            // Ensure amount and newBalance are numbers
            const numericAmount = typeof amount === 'number' ? amount : Number(amount);
            const numericNewBalance = typeof newBalance === 'number' ? newBalance : Number(newBalance);

            console.log("[sendPaymentSuccessEmail] Converted values:", {
                numericAmount,
                numericNewBalance
            });

            const user = await UserModel.findById(userId).populate('createdBy');


            if (!user) {

                return;
            }

            if (userRole === "B2B_ADMIN" || userRole === "MASTER" || userRole === "USER" || userRole === "AGENT") {
                const isSubCompany = user.createdBy !== undefined && user.createdBy !== null;


                if (isSubCompany) {
                    const subCompanyEmail = user.email;
                    const parentAdmin = await UserModel.findById(user.createdBy);




                    let parentWalletBalance = numericNewBalance;
                    if (parentAdmin) {
                        const parentWallet = await BookingPaymentRepository.getWallet(parentAdmin._id as Types.ObjectId);
                        parentWalletBalance = parentWallet?.balance ?? numericNewBalance;

                    }

                    if (subCompanyEmail) {

                        const subCompanyHtml = paymentSuccessEmailTemplate("SUB_COMPANY", {
                            bookingId,
                            amount: numericAmount,
                            newBalance: numericNewBalance,
                            companyName: user.businessProfile?.companyName,
                            parentCompanyName: parentAdmin?.businessProfile?.companyName,
                            paymentSource
                        });
                        await EmailService.sendEmail({
                            to: subCompanyEmail,
                            subject: "Booking Payment Processed Successfully",
                            html: subCompanyHtml
                        });

                    }

                    if (parentAdmin?.email) {

                        const parentHtml = paymentSuccessEmailTemplate("PARENT_ADMIN", {
                            bookingId,
                            amount: numericAmount,
                            newBalance: paymentSource === "SUB_COMPANY_WALLET" ? parentWalletBalance : numericNewBalance,
                            companyName: parentAdmin.businessProfile?.companyName,
                            paymentSource
                        });
                        await EmailService.sendEmail({
                            to: parentAdmin.email,
                            subject: "Booking Payment Processed - Sub-Company Transaction",
                            html: parentHtml
                        });

                    }
                } else {

                    const parentHtml = paymentSuccessEmailTemplate("PARENT_ADMIN", {
                        bookingId,
                        amount: numericAmount,
                        newBalance: numericNewBalance,
                        companyName: user.businessProfile?.companyName,
                        paymentSource
                    });
                    await EmailService.sendEmail({
                        to: user.email,
                        subject: "Booking Payment Processed - Wallet Debited",
                        html: parentHtml
                    });

                }
            }
            else if (userRole === "RM") {

                const parentAdmin = await UserModel.findById(user.createdBy);


                if (parentAdmin?.email) {
                    const rmHtml = paymentSuccessEmailTemplate("RM", {
                        bookingId,
                        amount: numericAmount,
                        newBalance: numericNewBalance,
                        companyName: parentAdmin.businessProfile?.companyName,
                        paymentSource
                    });
                    await EmailService.sendEmail({
                        to: parentAdmin.email,
                        subject: "Booking Payment Processed by RM",
                        html: rmHtml
                    });

                } else {

                }
            }
        } catch (error) {

        }
    }

    /**
     * Private methods ends here
     */


    static async checkWalletBalance(
        userId: Types.ObjectId,
        bookingId: string,
        totalPrice: number
    ) {

        const user = await UserModel.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        const userRole = Array.isArray(user.roles) ? user.roles[0] : user.roles;

        if (userRole === "RM") {
            return await this.handleRMBalanceCheck(userId, user, bookingId, totalPrice);
        }

        if (userRole === "B2B_ADMIN" || userRole === 'USER' || userRole === 'MASTER' || userRole === 'AGENT') {
            return await this.handleB2BAdminBalanceCheck(userId, user, bookingId, totalPrice);
        }

        const wallet = await BookingPaymentRepository.getWallet(userId);
        if (!wallet) throw new NotFoundError("Wallet not found");

        const existingPayment = await BookingPaymentRepository.checkExistingPayment(bookingId);
        const isAlreadyPaid = !!existingPayment;

        if (wallet.balance == null) {
            throw new BadRequestError("Wallet balance is not available");
        }

        const balance = wallet.balance;
        const hasSufficientBalance = balance >= totalPrice;
        const shortfallAmount = hasSufficientBalance ? 0 : totalPrice - balance;

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
        userRole: string | string[],
        bookingId: string,
        totalPrice: number
    ) {

        const user = await UserModel.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        const role = Array.isArray(userRole) ? userRole[0] : userRole;

        if (role === "RM") {
            const result = await this.handleRMPayment(userId, user, bookingId, totalPrice);

            return result;
        }

        if (role === "B2B_ADMIN" || role === "USER" || role === "MASTER" || role === "AGENT") {
            const result = await this.handleB2BAdminPayment(userId, user, bookingId, totalPrice);

            return result;
        }

        throw new BadRequestError(`Unsupported role: ${userRole}`);
    }

}