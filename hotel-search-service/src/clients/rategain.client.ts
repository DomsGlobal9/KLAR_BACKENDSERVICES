import axios from "axios";
import { env } from "../config/env";

export const rateGainClient = axios.create({
    baseURL: env.rateGain.baseUrl.replace(/\/$/, ""),
    // timeout: 60000,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": env.rateGain.apiKey,
        "apisecret": env.rateGain.apiSecret,
    },
});
