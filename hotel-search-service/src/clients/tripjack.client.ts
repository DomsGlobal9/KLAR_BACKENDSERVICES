import axios from "axios";
import { env } from "../config/env";

export const tripJackClient = axios.create({
  baseURL: env.tripJack.baseUrl,
  // Aligned with the 15s partial-return window in hotels.service: a supplier
  // call that outlives the window is abandoned there, and this stops the
  // underlying request from lingering long after. Configurable via env.
  timeout: Number(process.env.TJ_SEARCH_TIMEOUT_MS || 20000),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: env.tripJack.apiKey,
    apiKey: env.tripJack.apiKey,
    key: env.tripJack.apiKey,
    "x-api-key": env.tripJack.apiKey,
    Authorization: env.tripJack.apiKey,
    agencyId: env.tripJack.agencyId,
    agencyid: env.tripJack.agencyId,
    AgencyId: env.tripJack.agencyId,
    "Accept-Encoding": "gzip",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
