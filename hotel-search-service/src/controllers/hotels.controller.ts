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
    // Log the real upstream error server-side; never leak supplier status codes
    // or raw supplier messages to the client.
    console.error(
      "[Search] hotel search failed:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      status: false,
      statusCode: 500,
      description: "Hotel search is temporarily unavailable. Please try again.",
      body: [],
    });
  }
};

export const getStaticHotels = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const city = req.query.city as string;
    const propertyType = req.query.propertyType as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const data = await hotelsService.searchStaticHotels({
      city,
      propertyType,
      page,
    });
    res.status(200).json({
      status: true,
      body: data,
    });
  } catch (error: any) {
    console.error("[Explore] static hotel lookup failed:", error.message);
    res.status(500).json({
      status: false,
      description: "Could not load hotels right now. Please try again.",
      body: { hotels: [], hasMore: false, inventoryCount: 0 },
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
