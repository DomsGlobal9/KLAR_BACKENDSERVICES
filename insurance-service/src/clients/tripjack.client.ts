import axios from "axios";
import { env } from "../config/env";
import tripjackInsuranceConfig from "../config/tripjack.config";

/**
 * TripJack Insurance API Client
 * Single base URL for all TripSafe endpoints (Search, Review, Book, OMS).
 * All requests carry the shared TripJack apikey header.
 */
export const tripJackInsuranceClient = axios.create({
    baseURL: tripjackInsuranceConfig.BASE_URL,
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": tripjackInsuranceConfig.API_KEY,
    },
});
