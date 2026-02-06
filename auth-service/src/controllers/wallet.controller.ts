import { Response, NextFunction } from "express";
import { WalletService } from "../services/wallet.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../errors/AppError";
import { WalletTransaction } from "../models/walletTransaction.model";

export class WalletController {
    /**
     * Get wallet balance and details
     */
    static async getWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const wallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

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

    /**
     * Credit wallet (Admin/System use - Top-up, Refunds)
     */
    static async creditWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { amount, type, paymentMethod, referenceType, referenceId, description } = req.body;

            // Validation
            if (!amount || typeof amount !== "number" || amount <= 0) {
                throw new BadRequestError("Amount must be a positive number");
            }

            if (!type || !["TOP_UP", "REFUND"].includes(type)) {
                throw new BadRequestError("Type must be 'TOP_UP' or 'REFUND'");
            }

            if (!paymentMethod) {
                throw new BadRequestError("Payment method is required");
            }

            const wallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            if (!wallet) {
                throw new NotFoundError("Wallet not found");
            }

            const transaction = await WalletService.credit(
                wallet._id as Types.ObjectId,
                new Types.ObjectId(req.user.userId),
                amount,
                {
                    type,
                    paymentMethod,
                    referenceType: referenceType || null,
                    referenceId: referenceId || null,
                    description: description || `Wallet ${type.toLowerCase()}`,
                }
            );

            // Fetch updated wallet balance
            const updatedWallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            res.status(201).json({
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
        } catch (err) {
            next(err);
        }
    }

    /**
     * Debit wallet (Used for bookings/purchases)
     */
    static async debitWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { amount, referenceType, referenceId, description } = req.body;

            // Validation
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

            if (wallet.balance < amount) {
                throw new BadRequestError(`Insufficient balance. Available: ${wallet.balance}`);
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

            // Fetch updated wallet balance
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

    /**
     * Get wallet transaction history
     */
    static async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const wallet = await WalletService.getWallet(new Types.ObjectId(req.user.userId));

            if (!wallet) {
                throw new NotFoundError("Wallet not found");
            }

            // Pagination
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const skip = (page - 1) * limit;

            // Optional filters
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

    /**
     * Update wallet settings (alerts, low balance threshold)
     */
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

            // Update allowed fields
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

