import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import { OneWayNormalizer } from "../normalizers/oneway.normalizer";
import RedisCacheService from "../cache/redisCache.service";
import { ReturnNormalizer } from "../normalizers/return.normalizer";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";

class SearchService {

    async searchOneWay(payload: any) {

        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        try {
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

            const normalized = OneWayNormalizer.transform(rawResponse);

            await RedisCacheService.set(sessionId, {
                raw: rawResponse?.data?.searchResult?.tripInfos,
            }, 1800);

            return {
                sessionId,
                flights: normalized
            };

        } catch (error: any) {
            console.error("OneWay Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async searchReturn(payload: any) {

        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        try {
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

        } catch (error: any) {
            console.error("Return Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async searchMulticity(payload: any) {

        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        try {
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

        } catch (error: any) {
            console.error("MultiCity Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    // 🔹 REISSUE SEARCH INIT
    async reissueSearchInit(payload: any) {

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];

        const url = `${config.BASE_URL}/fms/v1/reissue/poll/searchquery-list`;

        try {

            const finalPayload = payload.searchQuery;

            console.log("FINAL PAYLOAD >>>", JSON.stringify(finalPayload, null, 2));

            const response = await axios.post(
                url,
                finalPayload,
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                }
            );

            return response.data;

        } catch (error: any) {
            console.error("Reissue Search Init ERROR >>>", error.response?.data || error.message);
            throw error;
        }
    }


    // 🔹 REISSUE SEARCH RESULT (POLLING)
    async reissueSearchResult(requestId: string) {

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];

        const url = `${config.BASE_URL}/fms/v1/reissue/poll/search`;

        try {
            const response = await axios.post(
                url,
                { requestId },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                }
            );

            return response.data;

        } catch (error: any) {
            console.error("Reissue Search Result ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new SearchService();