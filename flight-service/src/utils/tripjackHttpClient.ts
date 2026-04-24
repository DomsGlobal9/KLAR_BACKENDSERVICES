import axios, { AxiosInstance } from "axios";
import tripjackConfig from "../config/tripjack.config";

class TripjackHttpClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: tripjackConfig.BASE_URL,
            headers: {
                "Content-Type": "application/json",
                apikey: tripjackConfig.API_KEY,
            },
        });
    }

    public async post<TResponse, TRequest>(
        url: string,
        data: TRequest
    ): Promise<TResponse> {
        const response = await this.client.post<TResponse>(url, data);
        return response.data;
    }
}

export const tripjackHttpClient = new TripjackHttpClient();