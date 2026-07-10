import axios from "axios";
import { env } from "../config/env";

export const rateGainClient = axios.create({
  baseURL: env.rateGain.baseUrl.replace(/\/$/, ""),
  // Without this a stalled RateGain connection holds the request open forever —
  // the search orchestrator gives up at 15s, but /products has no such guard.
  timeout: Number(process.env.RG_TIMEOUT_MS || 25_000),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    ApiKey: env.rateGain.apiKey,
    ApiSecret: env.rateGain.apiSecret,
  },
});
