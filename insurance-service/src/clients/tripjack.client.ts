import axios from "axios";
import { env } from "../config/env";

/**
 * TripJack Insurance API Client
 * Single base URL for all TripSafe endpoints (Search, Review, Book, OMS).
 * All requests carry the shared TripJack apikey header.
 */
export const tripJackInsuranceClient = axios.create({
    baseURL: env.tripJack.baseUrl,
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": env.tripJack.apiKey,
    },
});
