import { Request, Response, NextFunction } from "express";
import { getFlightById, getFlightsByAirline, getUniqueFlights, searchFromTripJack } from "../services/tripjackService";
import { filterFlights } from "../utils/flightFilter";

export const searchFlights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("The request we got for search controller");
    const payload = req.body;

    if (!payload.searchQuery?.routeInfos || payload.searchQuery.routeInfos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid search payload: routeInfos is required and cannot be empty"
      });
    }

    const data = await searchFromTripJack(payload);

    return res.status(200).json({
      success: true,
      message: "Flights searched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const filterFlightsController = async (req: Request, res: Response) => {
  try {
    const { searchQuery, filters } = req.body;

    if (!searchQuery?.routeInfos || searchQuery.routeInfos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid search payload: routeInfos is required and cannot be empty"
      });
    }

    const flightsData = await searchFromTripJack({
      searchQuery: searchQuery,
      filters: filters
    });

    const filteredFlights = filterFlights(flightsData, filters);

    return res.status(200).json({
      success: true,
      message: "Flights filtered successfully",
      data: filteredFlights,
      count: filteredFlights.length
    });
  } catch (error) {
    console.error("Flight filter error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to filter flights",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const getFlightByIdController = async (req: Request, res: Response) => {
  try {
    const { searchPayload, flightId } = req.body;

    if (!flightId) {
      return res.status(400).json({
        success: false,
        message: "Flight ID is required"
      });
    }


    const flightsData = await searchFromTripJack(searchPayload);


    const flight = getFlightById(flightsData.data, flightId);

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
    console.error("Get flight by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get flight",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const getUniqueFlightsController = async (req: Request, res: Response) => {
  try {
    const searchPayload = req.body;


    const flightsData = await searchFromTripJack(searchPayload);


    const uniqueFlights = getUniqueFlights(flightsData.data);

    return res.status(200).json({
      success: true,
      message: "Unique flights retrieved successfully",
      data: uniqueFlights,
      count: uniqueFlights.length
    });
  } catch (error) {
    console.error("Get unique flights error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get unique flights",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const getFlightsByAirlineController = async (req: Request, res: Response) => {
  try {
    const { searchPayload, airlineCode } = req.body;

    if (!airlineCode) {
      return res.status(400).json({
        success: false,
        message: "Airline code is required"
      });
    }


    const flightsData = await searchFromTripJack(searchPayload);


    const airlineFlights = getFlightsByAirline(flightsData.data, airlineCode);

    return res.status(200).json({
      success: true,
      message: "Airline flights retrieved successfully",
      data: airlineFlights,
      count: airlineFlights.length
    });
  } catch (error) {
    console.error("Get airline flights error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get airline flights",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};