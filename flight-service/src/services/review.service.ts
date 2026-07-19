import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";
import RedisCacheService from "../cache/redisCache.service";
import { v4 as uuidv4 } from "uuid";
import { FlightReviewDataService } from "./flightReviewData.service";
import { envConfig } from "../config";

export const SERVICE_TYPES = {
    FLIGHTS: "FLIGHTS",
    HOTELS: "hotel",
    BUS: "bus",
    TRAIN: "train",
    INSURANCE: "insurance"
} as const;

class ReviewService {

    private reviewService = new FlightReviewDataService();

    async reviewFare(priceIds: string[]) {
        const sessionId = uuidv4();
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.REVIEW}`;

        try {
            const response = await axios.post(
                url,
                { priceIds },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    }
                }
            );

            const rawData = response.data;
            const mappedData = TripjackFieldMapper.map(rawData);


            await RedisCacheService.set(sessionId, {
                raw: mappedData,
            }, 1800);

            const markupData = await this.getMarkupByServiceType(SERVICE_TYPES.FLIGHTS);
            console.log("[MARKUP DATA] Markup data: ", markupData);


            return {
                mappedData,
                sessionId
            };

        } catch (error: any) {
            console.error("Review Fare ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            // Extract and format the error from TripJack response
            const tripjackError = error.response?.data;

            if (tripjackError && tripjackError.errors && tripjackError.errors.length > 0) {
                const firstError = tripjackError.errors[0];
                const customError = new Error(firstError.message);
                (customError as any).statusCode = error.response?.status || 400;
                (customError as any).errorCode = firstError.errCode;
                (customError as any).details = firstError.details;
                (customError as any).referenceId = firstError.id;
                throw customError;
            }

            // If no specific error from TripJack, throw generic error
            throw error;
        }
    }

    async getMarkupByServiceType(serviceType: string) {
        try {
            console.log(`[DEBUG] URL: ${envConfig.AUTH_SERVICE}`);

            const response = await axios.get(
                `${envConfig.AUTH_SERVICE}/markup/${serviceType}`,
                {
                    params: {
                        userId: process.env.USER_ID
                    },
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

            return response.data;
        } catch (error: any) {
            console.error("Get Markup API ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async beforeBookVerify(bookingIds: string) {

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.FARE_VALIDATE}`;

        try {
            const response = await axios.post(
                url,
                { bookingIds },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    }
                }
            );

            const rawData = response.data;

            const mappedData = TripjackFieldMapper.map(rawData);

            return {
                mappedData
            };

        } catch (error: any) {
            console.error("Before Book Verify ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new ReviewService();