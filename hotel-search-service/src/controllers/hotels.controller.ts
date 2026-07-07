import { Request, Response, NextFunction } from "express";
import { hotelsService } from "../services/hotels.service";
import { getClientType, extractToken } from "../utils/auth";
import { HotelModel } from "../models/Hotel.model";

export const searchHotels = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clientType = getClientType(req);
    const token = extractToken(req);
    const data = await hotelsService.searchHotels(req.body, clientType, token);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      status: false,
      statusCode: error.response?.status || 500,
      description: error.response?.data?.description || error.message,
      body: [],
    });
  }
};

export const getHotelSuggestions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = req.query.q as string;
    const clientType = getClientType(req);
    const data = await hotelsService.getHotelSuggestions(query, clientType);
    res.status(200).json({
      status: true,
      body: data,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      description: error.message,
      body: [],
    });
  }
};

export const getPopularAreas = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { PopularAreaModel } = require("../models/PopularArea.model");
    const docs = await PopularAreaModel.find().lean();
    
    const grouped: Record<string, Array<{ name: string; description: string; tag?: string }>> = {};
    for (const doc of docs) {
      if (!grouped[doc.cityKey]) {
        grouped[doc.cityKey] = [];
      }
      grouped[doc.cityKey].push({
        name: doc.name,
        description: doc.description,
        tag: doc.tag || undefined,
      });
    }

    res.status(200).json({
      status: true,
      body: grouped,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      description: error.message,
      body: {},
    });
  }
};

export const createHotel = async (req: Request, res: Response) => {
  try {
    const {
      tjHotelId,
      name,
      cityName,
      countryName,
      starRating,
      address,
      location,
      images,
      accTypeDesc,
      accMultiDesc,
      accomodationType,
      clientType,
    } = req.body;

    // Validation
    if (!tjHotelId || typeof tjHotelId !== "string") {
      return res.status(400).json({ status: false, message: "tjHotelId is required and must be a string" });
    }
    if (!name || typeof name !== "string") {
      return res.status(400).json({ status: false, message: "name is required and must be a string" });
    }
    if (!cityName || typeof cityName !== "string") {
      return res.status(400).json({ status: false, message: "cityName is required and must be a string" });
    }
    if (!clientType || (clientType !== "b2b" && clientType !== "b2c")) {
      return res.status(400).json({
        status: false,
        message: "clientType is required and must be either 'b2b' or 'b2c'",
      });
    }

    // Check if duplicate
    const existing = await HotelModel.findOne({ tjHotelId });
    if (existing) {
      return res.status(400).json({
        status: false,
        message: `Hotel with tjHotelId ${tjHotelId} already exists`,
      });
    }

    const hotel = new HotelModel({
      tjHotelId,
      name,
      cityName: cityName.toLowerCase().trim(),
      countryName: countryName || "",
      starRating: starRating || 0,
      address: address || "",
      location: location || { type: "Point", coordinates: [0, 0] },
      images: images || [],
      accTypeDesc: accTypeDesc || "",
      accMultiDesc: accMultiDesc || "",
      accomodationType: accomodationType || "",
      clientType,
    });

    await hotel.save();
    return res.status(201).json({ status: true, body: hotel });
  } catch (error: any) {
    return res.status(500).json({ status: false, description: error.message });
  }
};

export const updateHotel = async (req: Request, res: Response) => {
  try {
    const { tjHotelId } = req.params;
    const updates = req.body;

    if (updates.clientType && updates.clientType !== "b2b" && updates.clientType !== "b2c") {
      return res.status(400).json({
        status: false,
        message: "clientType must be either 'b2b' or 'b2c'",
      });
    }

    if (updates.cityName) {
      updates.cityName = updates.cityName.toLowerCase().trim();
    }

    // We can also allow updating tjHotelId if needed, but it's unique
    if (updates.tjHotelId) {
      delete updates.tjHotelId;
    }

    const updated = await HotelModel.findOneAndUpdate(
      { tjHotelId },
      { $set: updates },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({
        status: false,
        message: `Hotel with tjHotelId ${tjHotelId} not found`,
      });
    }

    return res.status(200).json({ status: true, body: updated });
  } catch (error: any) {
    return res.status(500).json({ status: false, description: error.message });
  }
};
