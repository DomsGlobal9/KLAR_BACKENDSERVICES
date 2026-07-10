import { Request, Response, NextFunction } from "express";
import { hotelsService } from "../services/hotels.service";
import { getClientType, extractToken } from "../utils/auth";

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
    const data = await hotelsService.getHotelSuggestions(query);
    // Suggestions are identical for every user, so let the browser and any CDN
    // in front of us absorb the repeats instead of re-hitting this service.
    res.set("Cache-Control", "public, max-age=300");
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
