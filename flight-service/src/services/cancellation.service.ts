import axios from "axios";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
import { BookingRepository } from "../repositories/bookingLocal.repository";

class CancellationService {

    private bookingRepo = new BookingRepository();

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

    async getCharges(payload: any) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        try {
            const response = await axios.post(
                `${baseUrl}${endpoints.AMENDMENT_CHARGES}`,
                payload,
                { headers }
            );

            return response.data;
        } catch (error: any) {

            const apiError = error.response?.data;

            console.error("Get Charges ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(apiError, null, 2),
                message: error.message
            });
            
            throw {
                success: false,
                httpStatus: error.response?.status || 500,
                error: apiError?.errors?.[0] || null,
                raw: apiError
            };
        }
    }

    async submit(payload: any) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        try {
            const response = await axios.post(
                `${baseUrl}${endpoints.SUBMIT_AMENDMENT}`,
                payload,
                { headers }
            );

            const amendmentId = response.data?.amendmentId;

            if (amendmentId) {
                await this.bookingRepo.updateBooking(payload.bookingId, {
                    amendmentId,
                    status: "CANCEL_REQUESTED",
                });
            }

            return response;

        } catch (error: any) {
            console.error("Submit Amendment ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async status(amendmentId: string) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        try {
            const response = await axios.post(
                `${baseUrl}${endpoints.AMENDMENT_DETAILS}`,
                { amendmentId },
                { headers }
            );

            const status = response.data?.status;
            const bookingId = response.data?.bookingId;

            if (status === "SUCCESS") {
                await this.bookingRepo.updateBookingStatus(
                    bookingId,
                    "CANCELLED"
                );
            }

            if (status === "REJECTED") {
                await this.bookingRepo.updateBookingStatus(
                    bookingId,
                    "CONFIRMED"
                );
            }

            return response;

        } catch (error: any) {
            console.error("Amendment Status ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new CancellationService();