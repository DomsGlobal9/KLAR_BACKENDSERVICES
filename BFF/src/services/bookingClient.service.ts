import axios from "axios";
import { envConfig } from "../config/env.config";

const BOOKING_SERVICE_URL = envConfig.SERVICES.BOOKING_SERVICE_URL;

export class BookingClientService {
    static async getDashboardStats(userId: string, token?: string) {
        try {
            const response = await axios.get(
                `${BOOKING_SERVICE_URL}/api/flights/my-booking/stats`,
                {
                    headers: token ? { Authorization: token } : {},
                    params: { userId }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error("Booking Service unavailable for dashboard stats:", error.message);
            return { success: false, data: { todaysBookings: 0, monthlyRevenue: 0, pendingActions: 0 } };
        }
    }
}
