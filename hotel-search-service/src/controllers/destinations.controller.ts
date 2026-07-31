import { Request, Response, NextFunction } from "express";
import { destinationsService } from "../services/destinations.service";

export const getDestinations = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await destinationsService.getDestinations();
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

/**
 * Cities of a country ordered by our inventory there — the data behind the
 * landing page's destination tiles. Cached hard upstream and identical for every
 * visitor, so let the browser hold it too.
 */
export const getCountryCities = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const country = String(req.query.country || "").trim();
    if (!country) {
      return res
        .status(400)
        .json({ status: false, description: "country is required", body: [] });
    }

    const limit = Math.min(Number(req.query.limit) || 12, 30);
    const cities = await destinationsService.getTopCities(country, limit);

    res.set("Cache-Control", "public, max-age=3600");
    res.status(200).json({ status: true, body: cities });
  } catch (error: any) {
    console.error("[Destinations] country cities failed:", error.message);
    // An empty list is a caption-less tile grid, not a broken page: callers fall
    // back to their curated list.
    res.status(200).json({ status: true, body: [] });
  }
};

export const getPopularDestinations = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await destinationsService.getPopularDestinations();
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
