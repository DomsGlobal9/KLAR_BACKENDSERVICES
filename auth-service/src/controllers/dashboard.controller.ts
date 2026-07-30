// controllers/dashboard.controller.ts   ← In your BFF
import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
import { Wallet } from "../models/wallet.model";
import axios from "axios";

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || "http://localhost:5011";

export class DashboardController {

    static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            // Call Booking Service for booking-related stats
            const bookingResponse = await axios.get(
                `${BOOKING_SERVICE_URL}/flights/my-booking/stats`,
                {
                    headers: { Authorization: req.headers.authorization },
                    params: { userId }
                }
            ).catch(() => ({ data: { data: { todaysBookings: 0, monthlyRevenue: 0, pendingActions: 0 } } }));

            const wallet = await Wallet.findOne({ userId }).select("balance currency");

            const stats = {
                walletBalance: wallet?.balance || 0,
                currency: wallet?.currency || "INR",

                todaysBookings: bookingResponse.data?.data?.todaysBookings || 0,
                monthlyRevenue: bookingResponse.data?.data?.monthlyRevenue || 0,
                pendingActions: bookingResponse.data?.data?.pendingActions || 0,
            };

            res.json({
                success: true,
                data: stats
            });

        } catch (error: any) {

            res.status(500).json({
                success: false,
                message: "Failed to fetch dashboard statistics"
            });
        }
    }
}