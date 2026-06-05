// import { Response, NextFunction } from "express";
// import { Types } from "mongoose";
// import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
// import { BookingPaymentService } from "../services/bookingPayment.service";
// import { BadRequestError } from "../errors/AppError";

// export class BookingPaymentController {

//     static async pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
//         console.log("******************** Entered Here in AUTH-BOOKING-PAYMENT-CONTROLLER");
//         try {
//             if (!req.user) {
//                 return res.status(401).json({
//                     success: false,
//                     message: "Unauthorized",
//                 });
//             }

//             const { bookingId, totalPrice } = req.body;

//             if (!bookingId) {
//                 throw new BadRequestError("Booking ID is required");
//             }

//             if (!totalPrice || totalPrice <= 0) {
//                 throw new BadRequestError("Invalid amount");
//             }

//             const result = await BookingPaymentService.payForBooking(
//                 new Types.ObjectId(req.user.userId),
//                 bookingId,
//                 totalPrice
//             );

//             res.status(200).json({
//                 success: true,
//                 message: result.isDuplicate
//                     ? "Payment already processed"
//                     : "Payment successful",
//                 data: {
//                     transactionId: result.transaction._id,
//                     amount: result.transaction.amount,
//                     balance: result.wallet.balance,
//                     isDuplicate: result.isDuplicate,
//                 },
//             });
//         } catch (err: any) {
//             next(err);
//         }
//     }

//     static async checkBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
//         try {
//             if (!req.user) {
//                 return res.status(401).json({
//                     success: false,
//                     message: "Unauthorized",
//                 });
//             }

//             const { bookingId } = req.params;
//             const { totalPrice } = req.query;

//             if (!bookingId) {
//                 throw new BadRequestError("Booking ID is required");
//             }

//             if (!totalPrice || Number(totalPrice) <= 0) {
//                 throw new BadRequestError("Invalid amount");
//             }

//             const result = await BookingPaymentService.checkWalletBalance(
//                 new Types.ObjectId(req.user.userId),
//                 bookingId as string,
//                 Number(totalPrice)
//             );


//             if (!result.hasSufficientBalance) {

//                 return res.status(400).json({
//                     success: false,
//                     message: result.isAlreadyPaid
//                         ? "Booking already paid"
//                         : `Insufficient wallet balance.\nRequired: ${result.requiredAmount}.\nAvailable: ${result.currentBalance}.\nShortfall: ${result.shortfallAmount}`,
//                     data: {
//                         hasSufficientBalance: result.hasSufficientBalance,
//                         currentBalance: result.currentBalance,
//                         requiredAmount: result.requiredAmount,
//                         shortfallAmount: result.shortfallAmount,
//                         bookingId: result.bookingId,
//                         isAlreadyPaid: result.isAlreadyPaid,
//                     },
//                 });
//             }

//             return true;

//             // res.status(200).json({
//             //     success: true,
//             //     message: "Sufficient balance available for booking payment",
//             //     data: {
//             //         hasSufficientBalance: result.hasSufficientBalance,
//             //         currentBalance: result.currentBalance,
//             //         requiredAmount: result.requiredAmount,
//             //         shortfallAmount: result.shortfallAmount,
//             //         bookingId: result.bookingId,
//             //         isAlreadyPaid: result.isAlreadyPaid,
//             //     },
//             // });
//         } catch (err: any) {
//             next(err);
//         }
//     }

// }





































import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
import { BookingPaymentService } from "../services/bookingPayment.service";
import { BadRequestError } from "../errors/AppError";

export class BookingPaymentController {

    static async pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        console.log("******************** Entered Here in AUTH-BOOKING-PAYMENT-CONTROLLER");
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized",
                });
            }

            const { bookingId, totalPrice } = req.body;

            if (!bookingId) {
                throw new BadRequestError("Booking ID is required");
            }

            if (!totalPrice || totalPrice <= 0) {
                throw new BadRequestError("Invalid amount");
            }

            const result = await BookingPaymentService.payForBooking(
                new Types.ObjectId(req.user.userId),
                bookingId,
                totalPrice
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
        } catch (err: any) {
            next(err);
        }
    }

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

            const result = await BookingPaymentService.checkWalletBalance(
                new Types.ObjectId(req.user.userId),
                bookingId as string,
                Number(totalPrice)
            );

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
                    walletUsed: result.walletUsed,
                },
            });
        } catch (err: any) {
            next(err); // Catching thrown explicit balance errors to route through your AppError handler
        }
    }
}