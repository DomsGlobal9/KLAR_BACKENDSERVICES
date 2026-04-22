import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";


class SeatService {

    async getSeats(bookingId: string) {
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEAT}`;

        console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
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

        console.log(response);

        const rawData = response.data;

        const mappedData = TripjackFieldMapper.map(rawData);

        return {
            data: mappedData
        };
    }
}

export default new SeatService();