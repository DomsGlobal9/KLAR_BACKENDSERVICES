import { Request, Response, NextFunction } from "express";
import { searchFromTripJack } from "../services/tripjackService";

export const searchFlights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body;
    console.log("📥 Incoming Flight Search Request:", JSON.stringify(payload, null, 2));

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
