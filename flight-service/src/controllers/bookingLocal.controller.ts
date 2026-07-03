import { Request, Response } from "express";
import BookingService from "../services/bookingLocal.service";
import { envConfig } from "../config/env.config";
import axios from "axios";
import TripjackBookingService from "../services/booking.service";
import { BookingVoucherPdfService } from "../services/bookingVoucherPdf.service";

class BookingLocalController {

    private authServiceUrl: string;
    private paymentServiceUrl: string;
    private currentToken: string | null = null;

    constructor() {
        this.authServiceUrl = envConfig.AUTH_SERVICE;
        this.paymentServiceUrl = envConfig.PAYMENT_SERVICE;
    }

    // *************************************************************************
    // ************************  Private Functions  ****************************
    // *************************************************************************

    private extractToken = (req: Request): string | null => {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            let token = authHeader.split(" ")[1];

            if (token && token.startsWith('{')) {
                try {
                    const parsed = JSON.parse(token);
                    token = parsed.value || parsed.token || token;
                } catch (e) {
                    // If parsing fails, keep as is
                }
            }

            this.currentToken = token;
            return token;
        }

        if (req.cookies?.token) {
            let token = req.cookies.token;

            if (token && token.startsWith('{')) {
                try {
                    const parsed = JSON.parse(token);
                    token = parsed.value || parsed.token || token;
                } catch (e) {
                    // If parsing fails, keep as is
                }
            }

            this.currentToken = token;
            return token;
        }

        return null;
    };

    private validateToken = async (token: string): Promise<any> => {
        try {
            let cleanToken = token;
            if (cleanToken && cleanToken.startsWith('{')) {
                try {
                    const parsed = JSON.parse(cleanToken);
                    cleanToken = parsed.value || parsed.token || cleanToken;
                } catch (e) {
                    // If parsing fails, keep as is
                }
            }

            const response = await axios.post(
                `${this.authServiceUrl}/auth/validate-token`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${cleanToken}`,
                    },
                }
            );

            if (response.data.success) {
                const userId = response.data.data.userId ||
                    response.data.data.id ||
                    response.data.data._id;

                if (!userId) {
                    throw new Error("No user ID in token validation response");
                }

                return {
                    id: userId,
                    email: response.data.data.email,
                    roles: response.data.data.roles || ["user"],
                    clientType: response.data.data.clientType || "b2c",
                };
            }

            throw new Error("Token validation failed");
        } catch (error: any) {
            throw new Error(
                error.response?.data?.message ||
                error.message ||
                "Token validation failed"
            );
        }
    };


    private deductWalletBalance = async (bookingId: string, totalPrice: string, userId?: string): Promise<any> => {
        try {

            const token = this.currentToken;

            if (!token) {
                throw new Error("Token missing for wallet deduction");
            }

            const response = await axios.post(
                `${this.authServiceUrl}/book/pay`,
                { bookingId, totalPrice, userId },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    }
                }
            );

            return response.data;



        } catch (error: any) {
            throw new Error(
                error.response?.data?.message ||
                error.message ||
                "Wallet deduction failed"
            );
        }
    };

    private WalletBalanceCheck = async (bookingId: string, totalPrice: string): Promise<any> => {
        try {
            const token = this.currentToken;

            if (!token) {
                return {
                    success: false,
                    message: "Token missing for wallet balance check",
                    hasSufficientBalance: false,
                    currentBalance: 0,
                    requiredAmount: Number(totalPrice),
                    shortfallAmount: Number(totalPrice),
                    isAlreadyPaid: false
                };
            }

            const response = await axios.get(
                `${this.authServiceUrl}/book/check-balance/${bookingId}`,
                {
                    params: { totalPrice },
                    headers: {
                        Authorization: `Bearer ${token}`,
                    }
                }
            );

            const walletBalanceCheckResponse = response.data;

            return walletBalanceCheckResponse;

        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || "Wallet balance check failed",
                hasSufficientBalance: false,
                currentBalance: 0,
                requiredAmount: Number(totalPrice),
                shortfallAmount: Number(totalPrice),
                isAlreadyPaid: false
            };
        }
    };

    private PaymentStatusCheck = async (orderId: string): Promise<any> => {
        try {
            const response = await axios.get(
                `${this.paymentServiceUrl}/razorpay/razorpay-order/${orderId}`
            );

            if (!response?.data?.success === true) {
                return {
                    status: 400,
                    success: false,
                    message: "Payment status check failed",
                }
            }

            return response.data.data;

        } catch (error: any) {
            return {
                status: 400,
                success: false,
                message: error.response?.data?.message || error.message || "Wallet balance check failed",
            };
        }
    };

    // *************************************************************************
    // ************************  Public Functions  ****************************
    // *************************************************************************

    public createLocalBooking = async (req: Request, res: Response) => {
        try {
            const { source } = req.body;

            let userData = null;

            if (source === 'b2c') {
                userData = {
                    id: 'guest_user',
                    email: req.body.email || 'guest@example.com',
                    role: 'guest'
                };
            } else {

                const token = this.extractToken(req);

                if (!token) {
                    return res.status(401).json({
                        success: false,
                        message: "Authorization token missing",
                    });
                }

                userData = await this.validateToken(token);

                if (!userData) {
                    return res.status(400).json({
                        success: false,
                        message: "User Data not found",
                    });
                }
            }

            const result = await BookingService.createInitialBooking(req.body, userData);

            return res.status(201).json({
                success: true,
                message: "Booking initialized successfully",
                data: result,
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    };

    public updateBookingDetails = async (req: Request, res: Response) => {
        try {
            const {
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice
            } = req.body;

            const missingFields = [];
            if (!bookingId) missingFields.push("bookingId");
            if (!tripjackPrice) missingFields.push("tripjackPrice");
            if (!markupPrice) missingFields.push("markupPrice");
            if (!totalPrice) missingFields.push("totalPrice");

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missingFields.join(", ")}`
                });
            }

            const result = await BookingService.updateBookingDetails({
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice
            });

            return res.status(200).json({
                success: true,
                message: "Booking updated successfully",
                data: result
            });

        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };

    public updateAndBook = async (req: Request, res: Response) => {
        try {
            console.log('🚀 === updateAndBook called ===');
            console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));

            const {
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold,
                orderId,
                source,
            } = req.body;

            console.log('📌 Parameters:', {
                bookingId,
                travellersCount: travellers?.length || 0,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold,
                orderId,
                source
            });

            if (!bookingId) {
                console.error('❌ bookingId is missing');
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required"
                });
            }

            let userData = null;
            let isB2CSource = false;

            console.log(`🔍 Source detected: ${source}`);

            if (source === 'b2c') {
                console.log('✅ B2C source detected - Setting up as B2C flow');
                isB2CSource = true;
                userData = {
                    id: 'guest_user',
                    clientType: 'b2c',
                    email: req.body.email || 'guest@example.com'
                };
                console.log('👤 B2C User Data:', userData);
            } else {
                console.log('🔄 Non-B2C source - Validating token...');
                const token = this.extractToken(req);

                if (!token) {
                    console.error('❌ Authorization token missing');
                    return res.status(401).json({
                        success: false,
                        message: "Authorization token missing",
                    });
                }

                console.log('🔑 Token validated successfully');
                userData = await this.validateToken(token);

                if (!userData?.clientType) {
                    console.error('❌ Invalid user data - clientType missing');
                    return res.status(400).json({
                        success: false,
                        message: "Invalid user data",
                    });
                }
                console.log('👤 User Data from token:', userData);
            }

            if (!isB2CSource && userData.clientType === 'b2c') {
                console.log('💰 B2C: Checking payment status for orderId:', orderId);

                if (!orderId) {
                    console.error('❌ B2C: orderId is required for payment verification');
                    return res.status(400).json({
                        success: false,
                        message: "orderId is required for B2C payment verification",
                    });
                }

                const paymentStatus = await this.PaymentStatusCheck(orderId);
                console.log('💰 B2C: Payment status response:', paymentStatus);

                if (paymentStatus.status != "paid") {
                    console.error(`❌ B2C: Payment not completed. Status: ${paymentStatus.status}`);
                    return res.status(400).json({
                        success: false,
                        message: "Payment not completed for this booking",
                        data: {
                            paymentStatus: paymentStatus.status
                        }
                    });
                }
                console.log('✅ B2C: Payment status verified - PAID');
            }

            if (!isB2CSource && userData.clientType === 'b2b') {
                console.log('💰 B2B: Checking wallet balance for bookingId:', bookingId);

                const balanceCheck = await this.WalletBalanceCheck(bookingId, totalPrice);
                console.log('💰 B2B: Wallet balance check result:', balanceCheck);

                if (
                    balanceCheck.success != true ||
                    balanceCheck.data.hasSufficientBalance != true
                ) {
                    console.error('❌ B2B: Insufficient wallet balance');
                    return res.status(400).json({
                        success: false,
                        message: balanceCheck.message,
                        data: {
                            currentBalance: balanceCheck.currentBalance,
                            requiredAmount: balanceCheck.requiredAmount,
                            shortfallAmount: balanceCheck.shortfallAmount,
                            isAlreadyPaid: balanceCheck.isAlreadyPaid
                        }
                    });
                }

                if (balanceCheck.isAlreadyPaid) {
                    console.warn('⚠️ B2B: Booking already paid');
                    return res.status(400).json({
                        success: false,
                        message: "Booking already paid",
                        data: {
                            bookingId,
                            isAlreadyPaid: true
                        }
                    });
                }
                console.log('✅ B2B: Wallet balance sufficient');
            }

            console.log('📝 Calling BookingService.updateAndTriggerBooking...');
            console.log('📊 Service Payload:', {
                bookingId,
                travellersCount: travellers?.length || 0,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold
            });

            const result = await BookingService.updateAndTriggerBooking({
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold
            });

            console.log('📥 Service result:', result);

            if (!result) {
                console.error('❌ Error while performing update or booking');
                return res.status(400).json({
                    success: false,
                    message: "Error while perform updating or booking"
                });
            }

            if (!isB2CSource && userData.clientType === 'b2c') {
                console.log('💰 B2C: Deducting wallet balance for bookingId:', bookingId);
                console.log('💰 B2C: Amount to deduct:', totalPrice);
                console.log('💰 B2C: Admin wallet ID: 6a1ed2fb290ce7d307b05784');

                await this.deductWalletBalance(
                    bookingId,
                    totalPrice,
                    '6a1ed2fb290ce7d307b05784'
                );
                console.log('✅ B2C: Wallet balance deducted successfully');
            }

            if (!isB2CSource && userData.clientType === 'b2b') {
                console.log('💰 B2B: Deducting wallet balance for bookingId:', bookingId);
                console.log('💰 B2B: Amount to deduct:', totalPrice);

                await this.deductWalletBalance(
                    bookingId,
                    totalPrice
                );
                console.log('✅ B2B: Wallet balance deducted successfully');
            }

            console.log('✅ === updateAndBook completed successfully ===');
            console.log('📊 Final Result:', result);

            return res.status(200).json({
                success: true,
                message: "Booking updated & TripJack triggered",
                data: result
            });

        } catch (error: any) {
            console.error('❌❌❌ updateAndBook Error:', error);
            console.error('Error stack:', error.stack);

            if (error.response?.data) {
                console.error('Tripjack Error Response:', JSON.stringify(error.response.data, null, 2));
                return res.status(error.response.status || 400).json({
                    success: false,
                    message: error.response.data?.errors?.[0]?.message || error.response.data?.message || "Tripjack API error",
                    data: error.response.data
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message || "An unexpected error occurred"
            });
        }
    };

    public getUserBookings = async (req: Request, res: Response) => {
        try {
            const token = this.extractToken(req);

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            const userData = await this.validateToken(token);

            if (!userData?.id) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user data",
                });
            }

            const bookings = await BookingService.getBookingsByUserId(userData.id);

            return res.status(200).json({
                success: true,
                data: bookings,
            });

        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    };

    public getBookingById = async (req: Request, res: Response) => {
        try {
            console.log("\n ************ SOURCE got: ", req.query.source);
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "Booking ID is required",
                });
            }

            // If source is b2c, get booking without user authentication
            if (req.query.source === 'b2c') {
                console.log(`📖 Fetching booking ${bookingId} for B2C source`);
                const booking = await BookingService.getBookingDetailsBySource(
                    bookingId as string,
                    'b2c'
                );

                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                }

                return res.status(200).json({
                    success: true,
                    data: booking,
                });
            }

            // For authenticated users
            const token = this.extractToken(req);

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            const userData = await this.validateToken(token);

            if (!userData?.id) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user data",
                });
            }

            console.log(`📖 Fetching booking ${bookingId} for user ${userData.id}`);
            const booking = await BookingService.getBookingDetailsByUser(
                bookingId as string,
                userData.id
            );

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found or unauthorized",
                });
            }

            return res.status(200).json({
                success: true,
                data: booking,
            });

        } catch (error: any) {
            console.error("Error in getBookingById:", error);
            return res.status(400).json({
                success: false,
                message: error.message || "Failed to fetch booking",
            });
        }
    };
}

export default new BookingLocalController();