import { Response, NextFunction } from "express";
import { WalletService } from "../services/wallet.service";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../errors/AppError";
import { WalletTransaction } from "../models/walletTransaction.model";
import { AuthService } from "../services/auth.service";

export class WalletController {

    static async getWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            let userId: Types.ObjectId;

            if (req.user?.clientType === 'b2c') {
                userId = new Types.ObjectId(process.env.USER_ID);
            } else {
                userId = new Types.ObjectId(req.user.userId);
            }

            const wallet = await WalletService.getWallet(userId);

            if (!wallet) {
                throw new NotFoundError("Wallet not found");
            }

            res.json({
                success: true,
                data: {
                    id: wallet._id,
                    balance: wallet.balance,
                    currency: wallet.currency,
                    status: wallet.status,
                    lowBalanceAlert: wallet.lowBalanceAlert,
                    emailAlerts: wallet.emailAlerts,
                    smsAlerts: wallet.smsAlerts,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    static async getWalletb2c(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (req.params.source === "b2c") {
                if (!req.query.amount) {
                    return res.status(400).json({ success: false, message: "Amount Required for validate" });
                }

                const userIdFromEnv = process.env.USER_ID;

                if (!userIdFromEnv) {
                    return res.status(500).json({
                        success: false,
                        message: "USER_ID not configured in environment"
                    });
                }

                const userId = new Types.ObjectId(userIdFromEnv);
                const wallet = await WalletService.getWallet(userId, req.query.amount as string);

                if (!wallet) {
                    throw new NotFoundError("Wallet not found");
                }

                const requestedAmount = Number(req.query.amount);
                const canUseWallet =
                    wallet.status === 'ACTIVE' &&
                    typeof wallet.balance === 'number' &&
                    wallet.balance >= requestedAmount;

                res.json({
                    success: true,
                    data: {
                        id: wallet._id,
                        balance: wallet.balance,
                        currency: wallet.currency,
                        status: wallet.status,
                        canUseWallet,
                        lowBalanceAlert: wallet.lowBalanceAlert,
                        emailAlerts: wallet.emailAlerts,
                        smsAlerts: wallet.smsAlerts,
                    },
                });
            }
        } catch (err) {
            next(err);
        }
    }

    /**
     * Credit an arbitrary user's wallet on behalf of another Klar service.
     *
     * Unlike `creditWallet`, the target user comes from the request body rather
     * than a JWT — background jobs (e.g. the hotel reconciliation worker) have
     * to refund the agent who owns a booking, not the token holder. Guarded by
     * `internalServiceAuth`.
     */
    static async internalCreditWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {


            const { userId, amount, type, paymentMethod, referenceType, referenceId, description } = req.body;



            if (!userId || !Types.ObjectId.isValid(userId)) {
                throw new BadRequestError("A valid userId is required");
            }

            if (!amount || typeof amount !== "number" || amount <= 0) {
                throw new BadRequestError("Amount must be a positive number");
            }

            if (!type || !["TOP_UP", "REFUND"].includes(type)) {
                throw new BadRequestError("Type must be 'TOP_UP' or 'REFUND'");
            }

            if (!paymentMethod) {
                throw new BadRequestError("Payment method is required");
            }

            const targetUserId = new Types.ObjectId(userId);
            const wallet = await WalletService.getWallet(targetUserId);

            if (!wallet || wallet.balance == null) {
                throw new BadRequestError("Wallet balance is not available");
            }

            const authService = AuthService.getInstance();
            const userData = await authService.getCurrentUser(userId);
            const createdByValue = userData?.createdBy;
            let parentWallet = null;
            let parentWalletId = null;
            let lastTransaction = null;

            if (createdByValue && createdByValue !== '' && Types.ObjectId.isValid(createdByValue)) {
                const parentUserId = new Types.ObjectId(createdByValue);
                parentWallet = await WalletService.getWallet(parentUserId);
                if (parentWallet) {
                    parentWalletId = parentWallet._id;
                }
            } else {
                const transaction = await WalletService.credit(
                    wallet._id,
                    targetUserId,
                    amount,
                    {
                        type,
                        paymentMethod,
                        referenceType: referenceType || null,
                        referenceId: referenceId || null,
                        description: description || `Wallet ${type.toLowerCase()}`,
                    }
                );

                const updatedWallet = await WalletService.getWallet(targetUserId);

                return res.status(201).json({
                    success: true,
                    message: "Wallet credited successfully",
                    data: {
                        transaction: {
                            id: transaction._id,
                            type: transaction.type,
                            direction: transaction.direction,
                            amount: transaction.amount,
                            status: transaction.status,
                        },
                        newBalance: updatedWallet?.balance,
                    },
                });
            }

            if (wallet.balance < 0 && parentWallet) {
                const amountToClearNegative = Math.abs(wallet.balance);
                let amountToCreditParent = 0;
                let amountToCreditChild = amount;

                if (amount <= amountToClearNegative) {
                    amountToCreditParent = amount;
                    amountToCreditChild = 0;
                } else {
                    amountToCreditParent = amountToClearNegative;
                    amountToCreditChild = amount - amountToClearNegative;
                }

                if (amountToCreditParent > 0) {
                    const parentTransaction = await WalletService.credit(
                        parentWalletId!,
                        parentWallet!.userId,
                        amountToCreditParent,
                        {
                            type: 'TOP_UP',
                            paymentMethod,
                            referenceType: referenceType || null,
                            referenceId: referenceId || null,
                            description: `Parent wallet credit for child debt (${description || 'Wallet top-up'})`,
                        }
                    );
                    lastTransaction = parentTransaction;
                }

                if (amountToCreditChild > 0) {
                    const childTransaction = await WalletService.credit(
                        wallet._id,
                        targetUserId,
                        amountToCreditChild,
                        {
                            type,
                            paymentMethod,
                            referenceType: referenceType || null,
                            referenceId: referenceId || null,
                            description: description || `Wallet ${type.toLowerCase()}`,
                        }
                    );
                    lastTransaction = childTransaction;
                }

            } else if (parentWallet) {
                const transaction = await WalletService.credit(
                    wallet._id,
                    targetUserId,
                    amount,
                    {
                        type,
                        paymentMethod,
                        referenceType: referenceType || null,
                        referenceId: referenceId || null,
                        description: description || `Wallet ${type.toLowerCase()}`,
                    }
                );
                lastTransaction = transaction;
            }

            const updatedWallet = await WalletService.getWallet(targetUserId);

            let updatedParentBalance = null;
            if (parentWallet) {
                const updatedParent = await WalletService.getWallet(parentWallet.userId);
                updatedParentBalance = updatedParent?.balance;
            }

            res.status(201).json({
                success: true,
                message: "Wallet credited successfully",
                data: {
                    childWallet: {
                        newBalance: updatedWallet?.balance,
                    },
                    parentWallet: parentWallet ? {
                        newBalance: updatedParentBalance,
                    } : null,
                    transaction: lastTransaction ? {
                        id: lastTransaction._id,
                        type: lastTransaction.type,
                        direction: lastTransaction.direction,
                        amount: lastTransaction.amount,
                        status: lastTransaction.status,
                    } : null,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    static async creditWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { amount, type, paymentMethod, referenceType, referenceId, description } = req.body;

            if (!amount || typeof amount !== "number" || amount <= 0) {
                throw new BadRequestError("Amount must be a positive number");
            }

            if (!type || !["TOP_UP", "REFUND"].includes(type)) {
                throw new BadRequestError("Type must be 'TOP_UP' or 'REFUND'");
            }

            if (!paymentMethod) {
                throw new BadRequestError("Payment method is required");
            }

            const userId = new Types.ObjectId(req.user.userId);
            const wallet = await WalletService.getWallet(userId);

            if (!wallet || wallet.balance == null) {
                throw new BadRequestError("Wallet balance is not available");
            }

            const authService = AuthService.getInstance();
            const userData = await authService.getCurrentUser(req.user.userId);

            const createdByValue = userData?.createdBy;
            let parentWallet = null;
            let parentWalletId = null;
            let lastTransaction = null;

            if (createdByValue && createdByValue !== '' && Types.ObjectId.isValid(createdByValue)) {
                const parentUserId = new Types.ObjectId(createdByValue);
                parentWallet = await WalletService.getWallet(parentUserId);
                if (parentWallet) {
                    parentWalletId = parentWallet._id;
                }
            } else {
                const transaction = await WalletService.credit(
                    wallet._id,
                    userId,
                    amount,
                    {
                        type,
                        paymentMethod,
                        referenceType: referenceType || null,
                        referenceId: referenceId || null,
                        description: description || `Wallet ${type.toLowerCase()}`,
                    }
                );

                const updatedWallet = await WalletService.getWallet(userId);

                return res.status(201).json({
                    success: true,
                    message: "Wallet credited successfully",
                    data: {
                        transaction: {
                            id: transaction._id,
                            type: transaction.type,
                            direction: transaction.direction,
                            amount: transaction.amount,
                            status: transaction.status,
                        },
                        newBalance: updatedWallet?.balance,
                    },
                });
            }

            if (wallet.balance < 0 && parentWallet) {
                const amountToClearNegative = Math.abs(wallet.balance);
                let amountToCreditParent = 0;
                let amountToCreditChild = amount;

                if (amount <= amountToClearNegative) {
                    amountToCreditParent = amount;
                    amountToCreditChild = 0;
                } else {
                    amountToCreditParent = amountToClearNegative;
                    amountToCreditChild = amount - amountToClearNegative;
                }

                if (amountToCreditParent > 0) {
                    const parentTransaction = await WalletService.credit(
                        parentWalletId!,
                        parentWallet!.userId,
                        amountToCreditParent,
                        {
                            type: 'TOP_UP',
                            paymentMethod,
                            referenceType: referenceType || null,
                            referenceId: referenceId || null,
                            description: `Parent wallet credit for child debt (${description || 'Wallet top-up'})`,
                        }
                    );
                    lastTransaction = parentTransaction;
                }

                if (amountToCreditChild > 0) {
                    const childTransaction = await WalletService.credit(
                        wallet._id,
                        userId,
                        amountToCreditChild,
                        {
                            type,
                            paymentMethod,
                            referenceType: referenceType || null,
                            referenceId: referenceId || null,
                            description: description || `Wallet ${type.toLowerCase()}`,
                        }
                    );
                    lastTransaction = childTransaction;
                }

            } else if (parentWallet) {
                const transaction = await WalletService.credit(
                    wallet._id,
                    userId,
                    amount,
                    {
                        type,
                        paymentMethod,
                        referenceType: referenceType || null,
                        referenceId: referenceId || null,
                        description: description || `Wallet ${type.toLowerCase()}`,
                    }
                );
                lastTransaction = transaction;
            }

            const updatedWallet = await WalletService.getWallet(userId);

            let updatedParentBalance = null;
            if (parentWallet) {
                const updatedParent = await WalletService.getWallet(parentWallet.userId);
                updatedParentBalance = updatedParent?.balance;
            }

            res.status(201).json({
                success: true,
                message: "Wallet credited successfully",
                data: {
                    childWallet: {
                        newBalance: updatedWallet?.balance,
                    },
                    parentWallet: parentWallet ? {
                        newBalance: updatedParentBalance,
                    } : null,
                    transaction: lastTransaction ? {
                        id: lastTransaction._id,
                        type: lastTransaction.type,
                        direction: lastTransaction.direction,
                        amount: lastTransaction.amount,
                        status: lastTransaction.status,
                    } : null,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    static async debitWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { amount, referenceType, referenceId, description } = req.body;

            if (!amount || typeof amount !== "number" || amount <= 0) {
                throw new BadRequestError("Amount must be a positive number");
            }

            if (!referenceType || !referenceId) {
                throw new BadRequestError("Reference type and reference ID are required");
            }

            const wallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            if (!wallet) {
                throw new NotFoundError("Wallet not found");
            }

            if (wallet.status === "BLOCKED") {
                throw new BadRequestError("Wallet is blocked");
            }

            if (wallet.balance == null) {
                throw new BadRequestError('Wallet balance is not available');
            }

            if (wallet.balance < amount) {
                throw new BadRequestError(
                    `Insufficient balance. Available: ${wallet.balance}`
                );
            }

            const transaction = await WalletService.debit(
                wallet._id as Types.ObjectId,
                new Types.ObjectId(req.user.userId),
                amount,
                {
                    type: "DEBIT",
                    referenceType,
                    referenceId,
                    description: description || `Payment for ${referenceType}`,
                }
            );

            const updatedWallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            res.status(201).json({
                success: true,
                message: "Wallet debited successfully",
                data: {
                    transaction: {
                        id: transaction._id,
                        type: transaction.type,
                        direction: transaction.direction,
                        amount: transaction.amount,
                        status: transaction.status,
                    },
                    newBalance: updatedWallet?.balance,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    static async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const wallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            if (!wallet) {
                throw new NotFoundError("Wallet not found");
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const skip = (page - 1) * limit;

            const filter: any = { walletId: wallet._id };

            if (req.query.type) {
                filter.type = req.query.type;
            }
            if (req.query.direction) {
                filter.direction = req.query.direction;
            }

            const [transactions, total] = await Promise.all([
                WalletTransaction.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                WalletTransaction.countDocuments(filter),
            ]);

            res.json({
                success: true,
                data: {
                    transactions,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                },
            });
        } catch (err) {
            next(err);
        }
    }

    static async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { lowBalanceAlert, emailAlerts, smsAlerts } = req.body;

            const wallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            if (!wallet) {
                throw new NotFoundError("Wallet not found");
            }

            if (lowBalanceAlert !== undefined) {
                if (typeof lowBalanceAlert !== "number" || lowBalanceAlert < 0) {
                    throw new BadRequestError("Low balance alert must be a non-negative number");
                }
                wallet.lowBalanceAlert = lowBalanceAlert;
            }
            if (emailAlerts !== undefined) {
                wallet.emailAlerts = Boolean(emailAlerts);
            }
            if (smsAlerts !== undefined) {
                wallet.smsAlerts = Boolean(smsAlerts);
            }

            await wallet.save();

            res.json({
                success: true,
                message: "Wallet settings updated",
                data: {
                    lowBalanceAlert: wallet.lowBalanceAlert,
                    emailAlerts: wallet.emailAlerts,
                    smsAlerts: wallet.smsAlerts,
                },
            });
        } catch (err) {
            next(err);
        }
    }
}