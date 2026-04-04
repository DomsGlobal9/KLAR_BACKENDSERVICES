import { Request, Response, NextFunction } from "express";
import { searchFromTripJack } from "../services/tripjackService";
import {
  transformFlightsForDisplay,
  getFlightDetailsById,
  getFlightList
} from "../utils/flightTransformer";
import { TripInfo } from "../interface/flight/flight.interface";
import { getFlightDetailsBySegmentId, getFlightSegmentById, getTransformedFlightSegment } from "../services/flightSegmentService";
import { isValidTripJackPayload } from "../middleware/flightPayloadHandler";
import { detectTripType, getTripInfos } from "../utils/tripTypeDetector";
import { extractSearchParams } from "../utils/searchParamsExtractor";
import { formatFlightResponse } from "../utils/responseFormatter";
import { validateSortOptions, sortFlights } from "../utils/sort/flightSort";
import { FilterValidator, filterFlights } from "../utils/filter";
import FlightPagination from "../utils/pagination";
import { searchStorage } from "../services/searchStorageService";


/**
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export const searchFlights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("From starting search payload", req.body);
    const payload = req.body;
    const sortOptions = validateSortOptions(req.query);
    const filters = FilterValidator.validateFilters(req.query);
    const paginationOptions = FlightPagination.validateOptions(req.query);

    // Generate session ID for this search
    const sessionId = req.headers['x-session-id'] as string || searchStorage.generateSessionId();

    // Check if this is a new search or same session
    const isNewSearch = req.headers['x-new-search'] === 'true' || !req.headers['x-session-id'];

    if (isNewSearch) {
      // Delete old search results if they exist
      const existingSession = req.headers['x-session-id'] as string;
      if (existingSession) {
        await searchStorage.deleteSearchResults(existingSession);
      }
    }

    if (!isValidTripJackPayload(payload)) {
      return res.status(400).json({
        success: false,
        message: "Invalid search payload..."
      });
    }

    const data = await searchFromTripJack(payload);

    const tripType = detectTripType(payload);
    const tripInfos = getTripInfos(data, tripType);
    let flightData = getFlightList(tripInfos, tripType);

    if (!FilterValidator.isEmpty(filters)) {
      flightData = filterFlights(flightData, tripType, filters);
    }

    flightData = sortFlights(flightData, tripType, sortOptions);

    const paginatedResult = FlightPagination.paginate(
      flightData,
      tripType,
      paginationOptions
    );

    const searchParams = extractSearchParams(payload);

    // STORE THE RESULTS IN REDIS
    await searchStorage.storeSearchResults(
      sessionId,
      tripType,
      searchParams,
      data, // raw TripJack response
      flightData // transformed data
    );

    console.log(`🔍 Search stored with session ID: ${sessionId}`);

    return res.status(200).json({
      success: true,
      message: "Flights searched successfully",
      sessionId, // Return session ID to frontend
      data: {
        searchType: tripType,
        routeCount: payload.searchQuery.routeInfos.length,
        flights: paginatedResult.data,
        totalFlights: paginatedResult.pagination.totalItems,
        searchParams,
        appliedSort: sortOptions,
        appliedFilters: filters || {},
        pagination: paginatedResult.pagination
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get flight details from stored session (NEW ENDPOINT)
 */
export const getFlightDetailsFromSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sessionId, flightId } = req.params;

    if (!sessionId || !flightId) {
      return res.status(400).json({
        success: false,
        message: "Session ID and Flight ID are required"
      });
    }

    // Get flight details from stored session
    const flightDetails = await searchStorage.getFlightDetails(sessionId, flightId);

    if (!flightDetails) {
      return res.status(404).json({
        success: false,
        message: "Flight not found. Session may have expired or flight ID is invalid."
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
 * Get flight by index (alternative approach)
 */
export const getFlightByIndex = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sessionId, tripType, flightIndex } = req.params;
    const legIndex = req.query.legIndex ? parseInt(req.query.legIndex as string) : undefined;

    if (!sessionId || !tripType || !flightIndex) {
      return res.status(400).json({
        success: false,
        message: "Session ID, Trip Type, and Flight Index are required"
      });
    }

    const flight = await searchStorage.getFlightByIndex(
      sessionId,
      tripType,
      parseInt(flightIndex),
      legIndex
    );

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Flight retrieved successfully",
      data: flight
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
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

/**
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
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
  console.log("🚀 API trigger: Get Flight Details by Segment ID");
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

    // Use the new function that returns ALL segments
    const flightDetails = await getFlightDetailsBySegmentId(payload, segmentId);

    if (!flightDetails) {
      return res.status(404).json({
        success: false,
        message: "Flight not found. The segment ID may be invalid."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Flight details retrieved successfully",
      data: flightDetails
    });
  } catch (error) {
    console.error("❌ Error in getSegmentById:", error);
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

