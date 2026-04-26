import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";

class SeatService {

    async getSeats(bookingId: string) {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEAT}`;

        try {
            const response = await axios.post(
                url,
                { bookingId },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                    // timeout: 15000,
                }
            );
            console.log("SEAT Response:", response);

            const rawData = response.data;

            const mappedData = TripjackFieldMapper.map(rawData);

            return {
                data: mappedData
            };

        } catch (error: any) {
            console.error("Seat Service ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new SeatService();