import axios from "axios";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
import { TripjackFieldMapper } from "../utils/mappers/tripJackBooking.mapper";

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

        const url = `${baseUrl}${endpoints.BOOK}`;

        try {
            const response = await axios.post(url, payload, { headers });
            return response;
        } catch (error: any) {


            console.error(
                "Tripjack ERROR DATA >>>",
                JSON.stringify(error.response?.data, null, 2)
            );



            throw error;
        }
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

    async getBookingDetails(bookingId: string) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        const url = `${baseUrl}${endpoints.BOOKING_DETAILS}`;

        try {
            const response = await axios.post(
                url,
                { bookingId, "requirePaxPricing": true },
                { headers }
            );

            const mappedResponse = TripjackFieldMapper.map(response.data);

            return mappedResponse;
        } catch (error: any) {
            console.error("Booking Details ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new BookingService();