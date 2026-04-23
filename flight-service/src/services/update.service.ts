import axios from "axios";
import { TRIPJACK_URLS, tripjackConfig } from "../config";

class UpdateService {
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

    async update(payload: any) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        return axios.post(
            `${baseUrl}${endpoints.SUBMIT_AMENDMENT}`,
            payload,
            { headers }
        );
    }
}

export default new UpdateService();