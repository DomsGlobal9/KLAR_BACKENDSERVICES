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
            return authHeader.split(" ")[1];
        }

        if (req.cookies?.token) {
            this.currentToken = req.cookies.token;
            return req.cookies.token;
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
                return response.data.data;
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

    private deductWalletBalance = async (bookingId: string, totalPrice: string): Promise<any> => {
        try {
            console.log("Wallet balance call");

            const token = this.currentToken;

            console.log({bookingId, totalPrice, token});

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

            console.log("Wallet balance response we got", response.data);

            return response.data;

        } catch (error: any) {
            throw new Error(
                error.response?.data?.message ||
                error.message ||
                "Wallet deduction failed"
            );
        }
    };

    public createLocalBooking = async (req: Request, res: Response) => {
        try {
            const token = this.extractToken(req);

            if (!token) {
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
                totalPrice
            } = req.body;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required"
                });
            }

            const result = await BookingService.updateAndTriggerBooking({
                bookingId,
                travellers,
                tripjackPrice,
                markupPrice,
                totalPrice
            });

            if (!result) {
                return res.status(400).json({
                    success: false,
                    message: "Error while perform updating or booking"
                });
            }

            await this.deductWalletBalance(bookingId, totalPrice);

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