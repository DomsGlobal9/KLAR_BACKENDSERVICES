import axios from "axios";
import { envConfig } from "../config/env";
import { getCache, setCache } from "./redisService";
import { TripJackRawModel } from "../models/tripJackRaw.model";

export const searchFromTripJack = async (payload: any) => {

  const cacheKey = JSON.stringify(payload);

  const cached = await getCache(cacheKey);
  
  if (cached) return JSON.parse(cached);

  const response = await axios.post(
    `${envConfig.TRIPJACK.BASE_URL}/fms/v1/air-search-all`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: envConfig.TRIPJACK.API_KEY,
      },
      timeout: 20000,
    }
  );

  TripJackRawModel.create({
    provider: "TRIPJACK",
    requestPayload: payload,
    responsePayload: response.data,
    searchKey: cacheKey,
  }).catch((err) => {
    console.error("Failed to store TripJack raw data", err);
  });

  setCache(cacheKey, JSON.stringify(response.data), 300);

  return response.data;
};

