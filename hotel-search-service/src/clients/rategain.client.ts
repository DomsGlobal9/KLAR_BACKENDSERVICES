import axios from "axios";
import { env } from "../config/env";

if (!env.rateGain.baseUrl) {
    console.error("[ERROR] RATEGAIN_BASE_URL is missing! Requests will fail.");
}

export const rateGainClient = axios.create({
    baseURL: env.rateGain.baseUrl || 'https://sandbox-smartdistribution.rategain.com', // Fallback for safety
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": env.rateGain.apiKey,
        "apisecret": env.rateGain.apiSecret,
    },
});
