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

    // private extractToken = (req: Request): string | null => {
    //     const authHeader = req.headers.authorization;

    //     if (authHeader?.startsWith("Bearer ")) {
    //         const token = authHeader.split(" ")[1];
    //         this.currentToken = token;
    //         return token;
    //     }

    //     if (req.cookies?.token) {
    //         const token = req.cookies.token;
    //         this.currentToken = token;
    //         return token;
    //     }

    //     return null;
    // };

    // private validateToken = async (token: string): Promise<any> => {
    //     try {
    //         const response = await axios.post(
    //             `${this.authServiceUrl}/auth/validate-token`,
    //             {},
    //             {
    //                 headers: {
    //                     Authorization: `Bearer ${token}`,
    //                 },
    //             }
    //         );

    //         if (response.data.success) {
    //             const userId = response.data.data.userId ||
    //                 response.data.data.id ||
    //                 response.data.data._id;

    //             if (!userId) {
    //                 console.error("❌ No user ID found in auth response:", response.data.data);
    //                 throw new Error("No user ID in token validation response");
    //             }

    //             return {
    //                 id: userId,
    //                 email: response.data.data.email,
    //                 roles: response.data.data.roles || ["user"],
    //                 clientType: response.data.data.clientType || "b2c",
    //             };
    //         }

    //         console.log("❌ TOKEN INVALID - success: false");
    //         throw new Error("Token validation failed");
    //     } catch (error: any) {
    //         console.log("\n🔴 VALIDATION ERROR 🔴");
    //         console.log("Error message:", error.message);

    //         if (error.response) {
    //             console.log("Error Status:", error.response.status);
    //             console.log("Error Data:", JSON.stringify(error.response.data, null, 2));
    //             console.log("Error Headers:", error.response.headers);
    //         } else if (error.request) {
    //             console.log("No response received from Auth Service");
    //             console.log("Request:", error.request);
    //         } else {
    //             console.log("Error setting up request:", error.message);
    //         }

    //         throw new Error(
    //             error.response?.data?.message ||
    //             error.message ||
    //             "Token validation failed"
    //         );
    //     }
    // };

    private extractToken = (req: Request): string | null => {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            let token = authHeader.split(" ")[1];

            // Check if token is a JSON string (stored as object with value/expiry)
            if (token && token.startsWith('{')) {
                try {
                    const parsed = JSON.parse(token);
                    // Extract the actual token from the JSON object
                    token = parsed.value || parsed.token || token;
                    console.log('✅ Extracted token from JSON object');
                } catch (e) {
                    // If parsing fails, keep as is
                    console.log('⚠️ Token parsing failed, using raw token');
                }
            }

            this.currentToken = token;
            return token;
        }

        if (req.cookies?.token) {
            let token = req.cookies.token;

            // Check if token is a JSON string
            if (token && token.startsWith('{')) {
                try {
                    const parsed = JSON.parse(token);
                    token = parsed.value || parsed.token || token;
                    console.log('✅ Extracted token from cookie JSON object');
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
            // Clean the token if it's still a JSON string
            let cleanToken = token;
            if (cleanToken && cleanToken.startsWith('{')) {
                try {
                    const parsed = JSON.parse(cleanToken);
                    cleanToken = parsed.value || parsed.token || cleanToken;
                    console.log('✅ Cleaned token from JSON object before validation');
                } catch (e) {
                    console.log('⚠️ Token parsing failed, using raw token');
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
                    console.error("❌ No user ID found in auth response:", response.data.data);
                    throw new Error("No user ID in token validation response");
                }

                return {
                    id: userId,
                    email: response.data.data.email,
                    roles: response.data.data.roles || ["user"],
                    clientType: response.data.data.clientType || "b2c",
                };
            }

            console.log("❌ TOKEN INVALID - success: false");
            throw new Error("Token validation failed");
        } catch (error: any) {
            console.log("\n🔴 VALIDATION ERROR 🔴");
            console.log("Error message:", error.message);

            if (error.response) {
                console.log("Error Status:", error.response.status);
                console.log("Error Data:", JSON.stringify(error.response.data, null, 2));
                console.log("Error Headers:", error.response.headers);
            } else if (error.request) {
                console.log("No response received from Auth Service");
                console.log("Request:", error.request);
            } else {
                console.log("Error setting up request:", error.message);
            }

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
            console.log("WALLET BALANCE CHECK - BOOK Local Service running");

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
            console.error("Wallet balance check error:", error);

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
            console.log("PAYMENT Status Check: \n", orderId);

            const response = await axios.get(
                `${this.paymentServiceUrl}/razorpay/razorpay-order/${orderId}`
            );

            console.log("#################\n", response);

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
            console.log("📝 createLocalBooking - START");

            const { source } = req.body;

            console.log("📝 createLocalBooking - Source:", source);
            let userData = null;

            if (source === 'b2c') {
                console.log("🟢 B2C source detected - Skipping token validation");

                userData = {
                    id: 'guest_user',
                    email: req.body.email || 'guest@example.com',
                    role: 'guest'
                };
            } else {

                const token = this.extractToken(req);

                if (!token) {
                    console.log("❌ createLocalBooking - No token");
                    return res.status(401).json({
                        success: false,
                        message: "Authorization token missing",
                    });
                }

                userData = await this.validateToken(token);
                console.log("👤 createLocalBooking - User validated:", userData?.id);

                if (!userData) {
                    console.log("❌ createLocalBooking - No user data");
                    return res.status(400).json({
                        success: false,
                        message: "User Data not found",
                    });
                }
            }

            const result = await BookingService.createInitialBooking(req.body, userData);
            console.log("✅ createLocalBooking - SUCCESS, Booking ID:", result?.bookingId);

            return res.status(201).json({
                success: true,
                message: "Booking initialized successfully",
                data: result,
            });
        } catch (error: any) {
            console.log("❌ createLocalBooking - ERROR:", error.message);
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
            const {
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold,
                orderId,
                source, // Added source from request body
            } = req.body;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required"
                });
            }

            let userData = null;
            let isB2CSource = false;

            // Check if source is 'b2c' - skip token validation
            if (source === 'b2c') {
                console.log("🟢 B2C source detected - Skipping token validation");
                isB2CSource = true;
                // Use default guest user data
                userData = {
                    id: 'guest_user',
                    clientType: 'b2c',
                    email: req.body.email || 'guest@example.com'
                };
            } else {
                // Normal flow - validate token
                const token = this.extractToken(req);

                if (!token) {
                    return res.status(401).json({
                        success: false,
                        message: "Authorization token missing",
                    });
                }

                userData = await this.validateToken(token);

                if (!userData?.clientType) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid user data",
                    });
                }
            }

            // Skip payment status check for B2C source (guest users)
            if (!isB2CSource && userData.clientType === 'b2c') {
                const paymentStatus = await this.PaymentStatusCheck(orderId);

                if (paymentStatus.status != "paid") {
                    return res.status(400).json({
                        success: false,
                        message: "Payment not completed for this booking",
                    });
                }
            }

            // Skip wallet balance check for B2C source (guest users)
            if (!isB2CSource && userData.clientType === 'b2b') {
                const balanceCheck = await this.WalletBalanceCheck(bookingId, totalPrice);

                if (
                    balanceCheck.success != true ||
                    balanceCheck.data.hasSufficientBalance != true
                ) {
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
                    return res.status(400).json({
                        success: false,
                        message: "Booking already paid",
                        data: {
                            bookingId,
                            isAlreadyPaid: true
                        }
                    });
                }
            }

            console.log("Wallet Checked properly. Now trying to book");

            const result = await BookingService.updateAndTriggerBooking({
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold
            });

            if (!result) {
                return res.status(400).json({
                    success: false,
                    message: "Error while perform updating or booking"
                });
            }

            // Skip wallet deduction for B2C source (guest users)
            if (!isB2CSource && userData.clientType === 'b2c') {
                await this.deductWalletBalance(
                    bookingId,
                    totalPrice,
                    '6a1ed2fb290ce7d307b05784'
                );
            }

            if (!isB2CSource && userData.clientType === 'b2b') {
                await this.deductWalletBalance(
                    bookingId,
                    totalPrice
                );
            }

            return res.status(200).json({
                success: true,
                message: "Booking updated & TripJack triggered",
                data: result
            });

        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };

    public getUserBookings = async (req: Request, res: Response) => {
        try {
            console.log("\n========== GET USER BOOKINGS ==========");
            const token = this.extractToken(req);

            if (!token) {
                console.log("❌ No token found");
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            console.log("✅ Token found, validating...");
            const userData = await this.validateToken(token);

            console.log("✅ User data after validation:", userData);

            if (!userData?.id) {
                console.log("❌ No user ID in userData");
                return res.status(400).json({
                    success: false,
                    message: "Invalid user data",
                });
            }

            console.log(`✅ Fetching bookings for user: ${userData.id}`);
            const bookings = await BookingService.getBookingsByUserId(userData.id);
            console.log(`✅ Found ${bookings.length} bookings`);

            return res.status(200).json({
                success: true,
                data: bookings,
            });

        } catch (error: any) {
            console.log("❌ Error:", error.message);
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    };

    public getBookingById = async (req: Request, res: Response) => {
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

            const { bookingId } = req.params;

            const booking = await BookingService.getBookingDetails(
                bookingId as string,
                userData.id
            );

            return res.status(200).json({
                success: true,
                data: booking,
            });

        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    };
}

export default new BookingLocalController();