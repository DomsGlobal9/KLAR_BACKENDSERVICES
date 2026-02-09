import axios from "axios";
import { envConfig } from "../config/env";
import { getCache, setCache } from "./redisService";

export const searchFromTripJack = async (payload: any) => {
  const cacheKey = JSON.stringify(payload);
  console.log("TripJack Search Request");
  console.log("Payload:", JSON.stringify(payload, null, 2));

  // 🔥 1. Check Cache First
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("Returning cached flight results");
    return JSON.parse(cached);
  }

  // 🌐 2. Call Supplier API
  const response = await axios.post(
    `${envConfig.TRIPJACK.BASE_URL}/fms/v1/air-search-all`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: envConfig.TRIPJACK.API_KEY,
      },
      timeout: 20000
    }
  );

  // 💾 3. Store in Redis (5 min)
  await setCache(cacheKey, JSON.stringify(response.data), 300);

  return response.data;
};
