import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";
import RedisCacheService from "../cache/redisCache.service";
import { v4 as uuidv4 } from "uuid";

class ReviewService {

    async reviewFare(priceIds: string[]) {

        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.REVIEW}`;

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

        const sessionData = await RedisCacheService.get(sessionId);

        console.log("@@@@@@@@@@@@@ Session Data:", JSON.stringify(sessionData, null, 2));

        return {
            mappedData,
            sessionId
        };
    }
}

export default new ReviewService();