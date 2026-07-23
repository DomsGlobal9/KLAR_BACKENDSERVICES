import { Request, Response, NextFunction } from "express";
import { searchService } from "../services/search.service";

export const locationSearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { input } = req.body;
        const result = await searchService.locationSearch(input);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getLatLong = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { placeId } = req.body;
        const result = await searchService.getLatLong(placeId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getQuotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log("[Cabs][Controller] getQuotes request body:", JSON.stringify(req.body, null, 2));
        // Channel and token come from the authenticated request, never the body:
        // a caller must not be able to select which markup prices their quote.
        const clientType =
            (req as any).user?.clientType ||
            (req.headers["x-client-type"] as string) ||
            "B2C";
        const token = req.headers.authorization?.split(" ")[1] || "";

        const result = await searchService.getQuotes(req.body, clientType, token);
        console.log("[Cabs][Controller] getQuotes success result:", JSON.stringify(result, null, 2).substring(0, 200) + "...");
        res.status(200).json(result);
    } catch (error) {
        console.error("[Cabs][Controller] getQuotes error:", error);
        next(error);
    }
};
