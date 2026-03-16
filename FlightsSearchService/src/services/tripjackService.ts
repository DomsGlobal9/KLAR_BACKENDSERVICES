import axios from "axios";
import { envConfig, getTripJackEndpoint } from "../config/env";
import { getCache, setCache } from "./redisService";
import { TripJackRawModel } from "../models/tripJackRaw.model";
import { AmendmentChargesRequest, AmendmentDetailsRequest, AmendmentSubmitRequest, AmendmentTrip } from "../interface/flight/amendment.interface";

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

/**
 * Retrieve booking from TripJack by booking ID
 */
export const retrieveBookingFromTripJack = async (bookingId: string, requirePaxPricing: boolean = true) => {
  const cacheKey = `booking_retrieve:${bookingId}:${requirePaxPricing}`;

  const cached = await getCache(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const url = getTripJackEndpoint('BOOKING_RETRIEVE');

    const payload = {
      bookingId,
      requirePaxPricing
    };

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: envConfig.TRIPJACK.API_KEY,
          agencyId: envConfig.TRIPJACK.AGENCY_ID,
        },
        timeout: envConfig.TRIPJACK.TIMEOUT,
      }
    );


    if (response.data?.status?.success === false) {
      return response.data;
    }


    await TripJackRawModel.create({
      provider: "TRIPJACK",
      endpoint: "BOOKING_RETRIEVE",
      requestPayload: payload,
      responsePayload: response.data,
      searchKey: cacheKey,
    }).catch((err) => {
      console.error("Failed to store TripJack booking retrieve raw data", err);
    });

    await setCache(cacheKey, JSON.stringify(response.data), 300);

    return response.data;
  } catch (error: any) {
    console.error("TripJack Booking Retrieve API Error:", {
      endpoint: getTripJackEndpoint('BOOKING_RETRIEVE'),
      bookingId,
      requirePaxPricing,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Retrieve booking with minimal details (without passenger pricing)
 */
export const retrieveBookingMinimal = async (bookingId: string) => {
  return retrieveBookingFromTripJack(bookingId, false);
};

/**
 * Retrieve booking with full details (with passenger pricing)
 */
export const retrieveBookingFull = async (bookingId: string) => {
  return retrieveBookingFromTripJack(bookingId, true);
};

/**
 * Get cancellation charges for a booking
 */
export const getCancellationCharges = async (
  bookingId: string,
  remarks: string = 'Cancellation request',
  trips?: AmendmentTrip[]
) => {
  const cacheKey = `cancellation_charges:${bookingId}:${JSON.stringify(trips)}`;

  try {
    const url = getTripJackEndpoint('AMENDMENT_CHARGES');

    const payload: AmendmentChargesRequest = {
      bookingId,
      type: 'CANCELLATION',
      remarks,
      ...(trips && { trips })
    };

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
      endpoint: "AMENDMENT_CHARGES",
      requestPayload: payload,
      responsePayload: response.data,
      searchKey: cacheKey,
    }).catch((err) => {
      console.error("Failed to store TripJack amendment charges raw data", err);
    });

    return response.data;
  } catch (error: any) {
    console.error("TripJack Amendment Charges API Error:", {
      endpoint: getTripJackEndpoint('AMENDMENT_CHARGES'),
      bookingId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Submit cancellation amendment
 */
export const submitCancellation = async (
  bookingId: string,
  remarks: string = 'Cancellation request',
  trips?: AmendmentTrip[]
) => {
  try {
    const url = getTripJackEndpoint('SUBMIT_AMENDMENT');

    const payload: AmendmentSubmitRequest = {
      bookingId,
      type: 'CANCELLATION',
      remarks,
      ...(trips && { trips })
    };

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
      endpoint: "SUBMIT_AMENDMENT",
      requestPayload: payload,
      responsePayload: response.data,
    }).catch((err) => {
      console.error("Failed to store TripJack submit amendment raw data", err);
    });

    return response.data;
  } catch (error: any) {
    console.error("TripJack Submit Amendment API Error:", {
      endpoint: getTripJackEndpoint('SUBMIT_AMENDMENT'),
      bookingId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Get amendment details (poll for status)
 */
export const getAmendmentDetails = async (amendmentId: string) => {
  try {
    const url = getTripJackEndpoint('AMENDMENT_DETAILS');

    const payload: AmendmentDetailsRequest = {
      amendmentId
    };

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

    return response.data;
  } catch (error: any) {
    console.error("TripJack Amendment Details API Error:", {
      endpoint: getTripJackEndpoint('AMENDMENT_DETAILS'),
      amendmentId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Complete cancellation flow with polling
 */
export const cancelBooking = async (
  bookingId: string,
  remarks: string = 'Cancellation request',
  trips?: AmendmentTrip[],
  pollInterval: number = 10000,
  maxAttempts: number = 5
) => {
  try {

    const chargesResponse = await getCancellationCharges(bookingId, remarks, trips);

    const submitResponse = await submitCancellation(bookingId, remarks, trips);

    if (!submitResponse.status?.success) {
      throw new Error('Failed to submit cancellation');
    }

    const { amendmentId } = submitResponse;

    let attempts = 0;
    while (attempts < maxAttempts) {
      const detailsResponse = await getAmendmentDetails(amendmentId);

      if (detailsResponse.status?.success) {
        const status = detailsResponse.amendmentStatus;

        if (status === 'SUCCESS') {
          return {
            success: true,
            amendmentId,
            status: 'SUCCESS',
            charges: detailsResponse.amendmentCharges,
            refundAmount: detailsResponse.refundableAmount,
            details: detailsResponse
          };
        } else if (status === 'REJECTED') {
          return {
            success: false,
            amendmentId,
            status: 'REJECTED',
            details: detailsResponse
          };
        }
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return {
      success: false,
      amendmentId,
      status: 'TIMEOUT',
      message: 'Cancellation processing timed out. Please check amendment details later.'
    };
  } catch (error) {
    console.error('Error in cancelBooking flow:', error);
    throw error;
  }
};