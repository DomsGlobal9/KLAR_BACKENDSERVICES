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
            const { totalPrice } = req.query;

            if (!bookingId) {
                throw new BadRequestError("Booking ID is required");
            }

            if (!totalPrice || Number(totalPrice) <= 0) {
                throw new BadRequestError("Invalid amount");
            }

            console.log("=== CONTROLLER: Before calling service ===");
            console.log("UserId:", req.user.userId);
            console.log("BookingId:", bookingId);
            console.log("TotalPrice:", totalPrice);

            const result = await BookingPaymentService.checkWalletBalance(
                new Types.ObjectId(req.user.userId),
                bookingId as string,
                Number(totalPrice)
            );

            console.log("=== CONTROLLER: After service call ===");
            console.log("Full result object:", JSON.stringify(result, null, 2));
            console.log("result.hasSufficientBalance:", result.hasSufficientBalance);
            console.log("result.currentBalance:", result.currentBalance);
            console.log("Type of result:", typeof result);
            console.log("Is result an object?", result && typeof result === 'object');

            // Check if result is empty
            if (result && Object.keys(result).length === 0) {
                console.error("ERROR: Result is an empty object!");
                throw new Error("Service returned empty result");
            }

            if (!result.hasSufficientBalance) {
                console.log("Insufficient balance - sending error response");
                return res.status(400).json({
                    success: false,
                    message: result.isAlreadyPaid
                        ? "Booking already paid"
                        : "Insufficient wallet balance",
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

            console.log("Sufficient balance - sending success response");
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
            console.error("=== CONTROLLER ERROR ===");
            console.error("Error:", err);
            console.error("Error message:", err.message);
            console.error("Stack trace:", err.stack);

            // Make sure we're not sending the wrong response
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

            const { bookingId, totalPrice } = req.body;

            if (!bookingId) {
                throw new BadRequestError("Booking ID is required");
            }

            if (!totalPrice || totalPrice <= 0) {
                throw new BadRequestError("Invalid amount");
            }

            const result = await BookingPaymentService.payForBooking(
                new Types.ObjectId(req.user.userId),
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
            next(err); // Catching thrown explicit balance errors to route through your AppError handler
        }
    }
}