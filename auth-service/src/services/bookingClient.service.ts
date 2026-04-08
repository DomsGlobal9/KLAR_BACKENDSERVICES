// services/bookingClient.service.ts
import axios from 'axios';

// const BOOKING_SERVICE_BASE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5011';

export class BookingClient {

    static async getDashboardStats(userId: string) {
        const response = await axios.post(
            `http://localhost:5011/api/flights/my-booking/stats`,
            { userId },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 7000
            }
        );
        return response.data;
    }

    static async getRecentBookings(userId: string, limit = 5) {
        const response = await axios.get(
            `http://localhost:5011/api/flights/my-booking/recent?limit=${limit}&userId=${userId}`
        );
        return response.data;
    }
}