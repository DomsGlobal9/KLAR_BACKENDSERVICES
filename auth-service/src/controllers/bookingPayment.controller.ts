import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
import { BookingPaymentService } from "../services/bookingPayment.service";
import { BadRequestError } from "../errors/AppError";

export class BookingPaymentController {

    static async checkBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized",
                });
            }

            const { bookingId } = req.params;
            const { totalPrice, userId } = req.query;

            if (!bookingId) {
                throw new BadRequestError("Booking ID is required");
            }

            if (Number(totalPrice) <= 0) {
                throw new BadRequestError("Invalid amount");
            }

            const targetUserId = userId
                ? new Types.ObjectId(userId as string)
                : new Types.ObjectId(req.user.userId);

            const result = await BookingPaymentService.checkWalletBalance(
                targetUserId,
                bookingId as string,
                Number(totalPrice)
            );

            if (result && Object.keys(result).length === 0) {

                throw new Error("Service returned empty result");
            }

            if (!result.hasSufficientBalance) {

                return res.status(400).json({
                    success: false,
                    message: result.isAlreadyPaid
                        ? "Booking already paid"
                        : "Insufficient wallet balance",
                        // : "Server error. Try again after sometime",
                    data: {
                        hasSufficientBalance: result.hasSufficientBalance,
                        currentBalance: result.currentBalance,
                        requiredAmount: result.requiredAmount,
                        shortfallAmount: result.shortfallAmount,
                        bookingId: result.bookingId,
                        isAlreadyPaid: result.isAlreadyPaid,
                    },
                });
            }

            return res.status(200).json({
                success: true,
                message: "Sufficient balance available for booking payment",
                data: {
                    hasSufficientBalance: result.hasSufficientBalance,
                    currentBalance: result.currentBalance,
                    requiredAmount: result.requiredAmount,
                    shortfallAmount: result.shortfallAmount,
                    bookingId: result.bookingId,
                    isAlreadyPaid: result.isAlreadyPaid,
                },
            });

        } catch (err: any) {





            if (err.statusCode === 400 || err instanceof BadRequestError) {
                return res.status(400).json({
                    success: false,
                    message: err.message,
                    data: {}
                });
            }

            next(err);
        }
    }

    static async pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {

        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized",
                });
            }

            const userRole = req.user.roles;

            const { bookingId, totalPrice, userId } = req.body;

            if (!bookingId) {
                throw new BadRequestError("Booking ID is required");
            }

            if (!totalPrice || totalPrice <= 0) {
                throw new BadRequestError("Invalid amount");
            }

             const targetUserId = userId
                ? new Types.ObjectId(userId as string)
                : new Types.ObjectId(req.user.userId);

            const result = await BookingPaymentService.payForBooking(
                targetUserId,
                userRole,
                bookingId,
                totalPrice
            );

            res.status(200).json({
                success: true,
                message: result.isDuplicate
                    ? "Payment already processed"
                    : "Payment successful",
                data: {
                    transactionId: result.transaction?._id,
                    amount: result.transaction?.amount,
                    balance: result.wallet?.balance,
                    isDuplicate: result.isDuplicate,
                },
            });
        } catch (err: any) {
            next(err);
        }
    }

}