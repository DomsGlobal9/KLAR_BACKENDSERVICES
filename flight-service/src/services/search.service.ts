import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import { OneWayNormalizer } from "../normalizers/oneway.normalizer";
import RedisCacheService from "../cache/redisCache.service";
import { ReturnNormalizer } from "../normalizers/return.normalizer";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";


class SearchService {

    /**
     * OneWay Search Service
     * @param payload 
     * @returns 
     */
    async searchOneWay(payload: any) {

        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;

        const config = TRIPJACK_URLS[env];

        const url = `${config.BASE_URL}${config.SEARCH}`;

        const rawResponse = await axios.post(
            url,
            {
                searchQuery: payload
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
                // timeout: 15000,
            }
        );

        const normalized = OneWayNormalizer.transform(rawResponse);

        await RedisCacheService.set(sessionId, {
            raw: rawResponse?.data?.searchResult?.tripInfos,
        }, 1800);

        return {
            sessionId,
            flights: normalized
        };
    }

    /**
     * Return Search Service
     * @param payload 
     * @returns 
     */
    async searchReturn(payload: any) {
        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        const rawResponse = await axios.post(
            url,
            { searchQuery: payload },
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
            }
        );

        const normalized = ReturnNormalizer.transform(rawResponse);

        await RedisCacheService.set(sessionId, {
            raw: rawResponse?.data?.searchResult?.tripInfos,
        }, 1800);

        return {
            sessionId,
            flights: normalized
        };
    }

    /**
     * MultiCity Search Service
     * @param payload 
     * @returns 
     */
    async searchMulticity(payload: any) {

        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        const rawResponse = await axios.post(
            url,
            { searchQuery: payload },
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
            }
        );

        const normalized = MultiCityNormalizer.normalize(rawResponse.data);

        await RedisCacheService.set(
            sessionId,
            {
                raw: rawResponse?.data?.searchResult?.tripInfos,
            },
            1800
        );

        return {
            sessionId,
            flights: normalized
        };
    }
}

export default new SearchService();