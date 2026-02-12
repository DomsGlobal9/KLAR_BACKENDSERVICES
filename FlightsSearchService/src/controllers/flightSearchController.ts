import { Request, Response, NextFunction } from "express";
import { searchFromTripJack } from "../services/tripjackService";
import {
  transformFlightsForDisplay,
  getFlightDetailsById,
  getFlightList
} from "../utils/flightTransformer";
import { TripInfo } from "../interface/flight/flight.interface";
import { getFlightSegmentById, getTransformedFlightSegment } from "../services/flightSegmentService";
import { isValidTripJackPayload } from "../middleware/flightPayloadHandler";

type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';


export const searchFlights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body;

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Invalid search payload..."
      });
    }

    const data = await searchFromTripJack(payload);


    const routeCount = payload.searchQuery.routeInfos.length;
    let tripType: TripType = 'ONE_WAY';

    if (routeCount === 1) {
      tripType = 'ONE_WAY';
    } else if (routeCount === 2) {
      tripType = 'RETURN';
    } else if (routeCount >= 3) {
      tripType = 'MULTI_CITY';
    }

    console.log("Route Count:", routeCount);
    console.log("Trip Type Detected:", tripType);


    let tripInfos: any;

    if (tripType === 'ONE_WAY') {
      tripInfos = data.searchResult?.tripInfos?.ONWARD || [];
    }
    else if (tripType === 'RETURN') {
      tripInfos = {
        ONWARD: data.searchResult?.tripInfos?.ONWARD || [],
        RETURN: data.searchResult?.tripInfos?.RETURN || []
      };
    }
    else if (tripType === 'MULTI_CITY') {

      tripInfos = {};


      console.log("Available TripInfos Keys:", Object.keys(data.searchResult?.tripInfos || {}));


      Object.keys(data.searchResult?.tripInfos || {}).forEach(key => {

        if (key !== 'ONWARD' && key !== 'RETURN') {
          tripInfos[key] = data.searchResult.tripInfos[key];
        }
      });

      console.log("Multi-city legs found:", Object.keys(tripInfos).length);
    }


    const flightList = getFlightList(tripInfos, tripType);

    return res.status(200).json({
      success: true,
      message: "Flights searched successfully",
      data: {
        searchType: tripType,
        routeCount,
        flights: flightList,
        totalFlights: Array.isArray(tripInfos)
          ? tripInfos.length
          : Object.keys(tripInfos).length,
        searchParams: {
          from: payload.searchQuery.routeInfos[0].fromCityOrAirport.code,
          to: payload.searchQuery.routeInfos[0].toCityOrAirport.code,
          travelDate: payload.searchQuery.routeInfos[0].travelDate,
          passengers: payload.searchQuery.paxInfo
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllFlightsWithDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body;

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Invalid search payload. Required structure: { searchQuery: { routeInfos: [{ fromCityOrAirport: { code }, toCityOrAirport: { code }, travelDate }], paxInfo: { ADULT, CHILD, INFANT } } }"
      });
    }

    const data = await searchFromTripJack(payload);
    const tripInfos: TripInfo[] = data.searchResult?.tripInfos?.ONWARD || [];

    const allFlights = transformFlightsForDisplay(tripInfos);

    return res.status(200).json({
      success: true,
      message: "All flights retrieved successfully",
      data: {
        searchType: payload.searchQuery.routeInfos.length === 1 ? 'ONE_WAY' : 'RETURN',
        count: allFlights.length,
        flights: allFlights,
        searchParams: {
          from: payload.searchQuery.routeInfos[0].fromCityOrAirport.code,
          to: payload.searchQuery.routeInfos[0].toCityOrAirport.code,
          travelDate: payload.searchQuery.routeInfos[0].travelDate,
          passengers: payload.searchQuery.paxInfo,
          cabinClass: payload.searchQuery.cabinClass
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getFlightDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { flightId } = req.params;
    const payload = req.body;

    if (!flightId) {
      return res.status(400).json({
        success: false,
        message: "Flight ID is required"
      });
    }

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Original search payload is required. Please provide the same search parameters used for initial search."
      });
    }

    const data = await searchFromTripJack(payload);
    const tripInfos: TripInfo[] = data.searchResult?.tripInfos?.ONWARD || [];

    const flightDetails = getFlightDetailsById(tripInfos, flightId);

    if (!flightDetails) {
      return res.status(404).json({
        success: false,
        message: "Flight not found. The flight ID may be invalid or the search results may have expired."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Flight details retrieved successfully",
      data: flightDetails
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get flight segment by ID (returns raw TripJack structure)
 */
export const getSegmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("API trigger the GET Segment Function");
  try {
    const { segmentId } = req.params;
    const payload = req.body;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: "Segment ID is required"
      });
    }

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Valid search payload is required"
      });
    }

    const segmentData = await getFlightSegmentById(payload, segmentId);

    if (!segmentData) {
      return res.status(404).json({
        success: false,
        message: "Flight segment not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Flight segment retrieved successfully",
      data: segmentData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transformed flight segment by ID (returns clean, structured data)
 */
export const getTransformedSegmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { segmentId } = req.params;
    const payload = req.body;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: "Segment ID is required"
      });
    }

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Valid search payload is required"
      });
    }

    const transformedData = await getTransformedFlightSegment(payload, segmentId);

    if (!transformedData) {
      return res.status(404).json({
        success: false,
        message: "Flight segment not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Flight segment retrieved successfully",
      data: transformedData
    });
  } catch (error) {
    next(error);
  }
};

