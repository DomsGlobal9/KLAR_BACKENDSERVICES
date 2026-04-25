import axios from "axios";
import { env } from "../config/env";

/**
 * TripJack Cabs API Client
 * Configured with shared API key headers.
 */
export const tripJackCabsClient = axios.create({
    baseURL: env.tripJack.baseUrl,
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": env.tripJack.apiKey,
        "agencyId": env.tripJack.agencyId,
        "Accept-Encoding": "gzip"
    },
});
