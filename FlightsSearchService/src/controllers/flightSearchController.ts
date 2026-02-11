import { Request, Response, NextFunction } from "express";
import { searchFromTripJack } from "../services/tripjackService";
import {
  transformFlightsForDisplay,
  getFlightDetailsById,
  getFlightList
} from "../utils/flightTransformer";
import { TripInfo, TripJackSearchPayload } from "../interface/flight/flight.interface";
import { getFlightSegmentById, getTransformedFlightSegment } from "../services/flightSegmentService";



function isValidTripJackPayload(payload: any): payload is TripJackSearchPayload {
  return (
    payload &&
    payload.searchQuery &&
    Array.isArray(payload.searchQuery.routeInfos) &&
    payload.searchQuery.routeInfos.length > 0 &&
    payload.searchQuery.routeInfos.every((route: any) =>
      route.fromCityOrAirport?.code &&
      route.toCityOrAirport?.code &&
      route.travelDate
    ) &&
    payload.searchQuery.paxInfo &&
    typeof payload.searchQuery.paxInfo.ADULT === 'string'
  );
}

export const searchFlights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Search flights request received");
    const payload = req.body;

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Invalid search payload. Required structure: { searchQuery: { routeInfos: [{ fromCityOrAirport: { code }, toCityOrAirport: { code }, travelDate }], paxInfo: { ADULT, CHILD, INFANT } } }"
      });
    }

    const data = await searchFromTripJack(payload);

    const tripInfos: TripInfo[] = data.searchResult?.tripInfos?.ONWARD || [];

    const flightList = getFlightList(tripInfos);

    return res.status(200).json({
      success: true,
      message: "Flights searched successfully",
      data: {
        searchType: payload.searchQuery.routeInfos.length === 1 ? 'ONE_WAY' : 'RETURN',
        flights: flightList,
        totalFlights: flightList.length,
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

