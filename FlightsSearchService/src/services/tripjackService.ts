import axios from "axios";
import { envConfig, getTripJackEndpoint } from "../config/env";
import { getCache, setCache } from "./redisService";
import { TripJackRawModel } from "../models/tripJackRaw.model";

export const searchFromTripJack = async (payload: any) => {
  const cacheKey = JSON.stringify(payload);

  const cached = await getCache(cacheKey);
  if (cached) return JSON.parse(cached);

  try {

    const url = getTripJackEndpoint('AIR_SEARCH_ALL');

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: envConfig.TRIPJACK.API_KEY,
        },
        timeout: envConfig.TRIPJACK.TIMEOUT,
      }
    );

    await TripJackRawModel.create({
      provider: "TRIPJACK",
      requestPayload: payload,
      responsePayload: response.data,
      searchKey: cacheKey,
    }).catch((err) => {
      console.error("Failed to store TripJack raw data", err);
    });

    await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);

    return response.data;
  } catch (error: any) {
    console.error("TripJack API Error:", {
      endpoint: getTripJackEndpoint('AIR_SEARCH_ALL'),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Get fare rules from TripJack
 */
export const getFareRulesFromTripJack = async (payload: { id: string; flowType: 'SEARCH' | 'REVIEW' }) => {
  const cacheKey = `fare_rule:${payload.id}:${payload.flowType}`;

  const cached = await getCache(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const url = getTripJackEndpoint('FARE_RULE');

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: envConfig.TRIPJACK.API_KEY,
        },
        timeout: envConfig.TRIPJACK.TIMEOUT,
      }
    );

    await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);

    return response.data;
  } catch (error: any) {
    console.error("TripJack Fare Rule API Error:", {
      endpoint: getTripJackEndpoint('FARE_RULE'),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Get review from TripJack
 */
export const getReviewFromTripJack = async (payload: any) => {
  const cacheKey = `review:${JSON.stringify(payload)}`;

  const cached = await getCache(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const url = getTripJackEndpoint('REVIEW');

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: envConfig.TRIPJACK.API_KEY,
          ...(envConfig.TRIPJACK.TOKEN && { Authorization: `Bearer ${envConfig.TRIPJACK.TOKEN}` }),
        },
        timeout: envConfig.TRIPJACK.TIMEOUT,
      }
    );

    await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);
    return response.data;
  } catch (error: any) {
    console.error("TripJack Review API Error:", {
      endpoint: getTripJackEndpoint('REVIEW'),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Revalidate booking with TripJack
 */
export const revalidateWithTripJack = async (payload: any) => {
  const cacheKey = `revalidate:${JSON.stringify(payload)}`;

  const cached = await getCache(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const url = getTripJackEndpoint('REVALIDATE');

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: envConfig.TRIPJACK.API_KEY,
          ...(envConfig.TRIPJACK.TOKEN && { Authorization: `Bearer ${envConfig.TRIPJACK.TOKEN}` }),
        },
        timeout: envConfig.TRIPJACK.TIMEOUT,
      }
    );

    await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);
    return response.data;
  } catch (error: any) {
    console.error("TripJack Revalidate API Error:", {
      endpoint: getTripJackEndpoint('REVALIDATE'),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Get fare quote from TripJack
 */
export const getFareQuoteFromTripJack = async (payload: any) => {
  const cacheKey = `fare_quote:${JSON.stringify(payload)}`;

  const cached = await getCache(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const url = getTripJackEndpoint('FARE_QUOTE');

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: envConfig.TRIPJACK.API_KEY,
        },
        timeout: envConfig.TRIPJACK.TIMEOUT,
      }
    );

    await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);
    return response.data;
  } catch (error: any) {
    console.error("TripJack Fare Quote API Error:", {
      endpoint: getTripJackEndpoint('FARE_QUOTE'),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};