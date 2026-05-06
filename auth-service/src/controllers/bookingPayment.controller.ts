import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
import { BookingPaymentService } from "../services/bookingPayment.service";
import { BadRequestError } from "../errors/AppError";

export class BookingPaymentController {
    static async pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized",
                });
            }

            const { bookingId, amount } = req.body;

            if (!bookingId) {
                throw new BadRequestError("Booking ID is required");
            }

            if (!amount || amount <= 0) {
                throw new BadRequestError("Invalid amount");
            }

            const result = await BookingPaymentService.payForBooking(
                new Types.ObjectId(req.user.userId),
                bookingId,
                amount
            );

            res.status(200).json({
                success: true,
                message: result.isDuplicate
                    ? "Payment already processed"
                    : "Payment successful",
                data: {
                    transactionId: result.transaction._id,
                    amount: result.transaction.amount,
                    balance: result.wallet.balance,
                    isDuplicate: result.isDuplicate,
                },
            });
        } catch (err) {
            next(err);
        }
    }
}