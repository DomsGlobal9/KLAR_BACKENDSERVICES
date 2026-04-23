import axios from "axios";
import { TRIPJACK_URLS, tripjackConfig } from "../config";

class BookingService {
    private getConfig() {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];

        return {
            baseUrl: config.BASE_URL,
            headers: {
                "Content-Type": "application/json",
                apikey: tripjackConfig.API_KEY,
            },
            endpoints: config,
        };
    }

    async book(payload: any) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        const response = await axios.post(
            `${baseUrl}${endpoints.BOOK}`,
            payload,
            { headers }
        );

        console.log("Tripjack response >>>", response.data);

        return response;
    }

    async validateFare(bookingId: string) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        return axios.post(
            `${baseUrl}${endpoints.FARE_VALIDATE}`,
            { bookingId },
            { headers }
        );
    }

    async confirmBooking(bookingId: string, amount: number) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        return axios.post(
            `${baseUrl}${endpoints.CONFIRM_BOOK}`,
            {
                bookingId,
                paymentInfos: [{ amount }],
            },
            { headers }
        );
    }
}

export default new BookingService();