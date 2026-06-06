import { Request, Response } from "express";
import BookingService from "../services/bookingLocal.service";
import { envConfig } from "../config/env.config";
import axios from "axios";

class BookingLocalController {

    private authServiceUrl: string;
    private currentToken: string | null = null;

    constructor() {
        this.authServiceUrl = envConfig.AUTH_SERVICE;
    }

    private extractToken = (req: Request): string | null => {

        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            this.currentToken = token;
            return token;
        }

        if (req.cookies?.token) {
            const token = req.cookies.token;
            this.currentToken = token;
            return token;
        }

        return null;
    };

    private validateToken = async (token: string): Promise<any> => {
        try {
            const response = await axios.post(
                `${this.authServiceUrl}/auth/validate-token`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
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
                    roles: response.data.data.roles || ['user'],
                    clientType: response.data.data.clientType || 'B2C'
                };
            }

            console.log("❌ TOKEN INVALID - success: false");
            throw new Error("Token validation failed");

        } catch (error: any) {
            // ✅ ADD THESE LOGS - See the exact error
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

    private deductWalletBalance = async (bookingId: string, totalPrice: string): Promise<any> => {
        try {

            const token = this.currentToken;

            if (!token) {
                throw new Error("Token missing for wallet deduction");
            }

            const response = await axios.post(
                `${this.authServiceUrl}/book/pay`,
                { bookingId, totalPrice },
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
                    status: 404,
                    success: false,
                    message: "Token missing for wallet balance check",
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
                status: 400,
                success: false,
                message: error.response?.data?.message || error.message || "Wallet balance check failed",
            };
        }
    };

    public createLocalBooking = async (req: Request, res: Response) => {
        try {
            const token = this.extractToken(req);


            if (!token) {
                console.log("❌ NO TOKEN - Returning 401");
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            const userData = await this.validateToken(token);

            if (!userData) {
                return res.status(400).json({
                    success: false,
                    message: "User Data not found",
                });
            }

            const result = await BookingService.createInitialBooking(req.body, userData);

            return res.status(201).json({
                success: true,
                message: "Booking initialized successfully",
                data: result,
            });

        } catch (error: any) {
            // ✅ ADD THIS LOG - See the actual error
            console.log("❌ CATCH BLOCK ERROR:", error.message);
            console.log("❌ Full error:", error);

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
            console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
            const {
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice,
                isHold
            } = req.body;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required"
                });
            }

            // Check wallet balance first
            const balanceCheck = await this.WalletBalanceCheck(bookingId, totalPrice);

            
            if (!balanceCheck.success || !balanceCheck.hasSufficientBalance) {
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

            // Deduct wallet after successful booking
            await this.deductWalletBalance(bookingId, totalPrice);

            return res.status(200).json({
                success: true,
                message: "Booking updated & TripJack triggered",
                data: result
            });

        } catch (error: any) {
            console.log("$$$$$$$$$$$$$$$$$ Entering into catch in UPDATE-AND-BOOK");
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