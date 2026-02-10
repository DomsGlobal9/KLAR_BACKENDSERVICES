import axios from "axios";
import { envConfig } from "../config/env";
import { getCache, setCache } from "./redisService";
import { mapTripJackResponse } from "../utils/flightMapper";
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

  const filteredData = mapTripJackResponse(response.data);

  setCache(cacheKey, JSON.stringify(filteredData), 300);

  return filteredData;
};

/**
 * Get Uniue Flights
 * @param flights 
 * @returns 
 */
export const getUniqueFlights = (flights: any[]) => {
  const flightMap = new Map();

  flights.forEach(flight => {
    const key = `${flight.flight.code}-${flight.flight.number}`;
    if (!flightMap.has(key)) {
      flightMap.set(key, {
        ...flight,
        fareOptions: []
      });
    }


    const existingFlight = flightMap.get(key);
    existingFlight.fareOptions.push({
      class: flight.flight.class,
      fareIdentifier: flight.fareIdentifier,
      price: flight.price.adult,
      baggage: flight.baggage
    });
  });

  return Array.from(flightMap.values());
};

/**
 * Get flight by id
 * @param flights 
 * @param flightId 
 * @returns 
 */
export const getFlightById = (flights: any[], flightId: string) => {
  const [airlineCode, flightNumber] = flightId.split('-');

  const flightInstances = flights.filter(
    flight => flight.flight.code === airlineCode && flight.flight.number === flightNumber
  );

  if (flightInstances.length === 0) {
    return null;
  }

  
  const fareOptions = flightInstances.map(flight => ({
    class: flight.flight.class,
    fareIdentifier: flight.fareIdentifier,
    price: flight.price,
    baggage: flight.baggage
  }));

  
  const baseFlight = { ...flightInstances[0] };
  delete baseFlight.fareIdentifier; 

  return {
    ...baseFlight,
    fareOptions,
    fareSummary: {
      minPrice: Math.min(...fareOptions.map(f => f.price.adult)),
      maxPrice: Math.max(...fareOptions.map(f => f.price.adult)),
      availableClasses: [...new Set(fareOptions.map(f => f.class))],
      availableFareTypes: [...new Set(fareOptions.map(f => f.fareIdentifier))]
    }
  };
};

/**
 * Get flights by airline name
 * @param flights 
 * @param airlineCode 
 * @returns 
 */
export const getFlightsByAirline = (flights: any[], airlineCode: string) => {
  const airlineFlights = flights.filter(
    flight => flight.flight.code === airlineCode
  );
  
  return getUniqueFlights(airlineFlights);
};