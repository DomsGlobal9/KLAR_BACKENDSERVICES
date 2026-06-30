import axios from "axios";
import { env } from "../config/env";

/**
 * HMS Client - Hotel Management APIs (pricing, review)
 * Base: https://apitest-hms.tripjack.com
 */
export const tripJackHmsClient = axios.create({
  baseURL: env.tripJack.baseUrl,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: env.tripJack.apiKey,
    agencyId: env.tripJack.agencyId,
    "Accept-Encoding": "gzip",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

/**
 * OMS Client - Order Management APIs (book, booking-details, cancel)
 * Base: https://apitest-oms.tripjack.com
 */
export const tripJackOmsClient = axios.create({
  baseURL: env.tripJack.omsBaseUrl,
  timeout: 120000, // 120s — confirm-book can be slow (payment processing)
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: env.tripJack.apiKey,
    agencyId: env.tripJack.agencyId,
    "Accept-Encoding": "gzip",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
