import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { searchService } from "../services/search.service";

export const searchController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await searchService.search(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("[Insurance][Search Error]", error?.message || error);
        const status  = error.status || error.response?.status || 500;
        const message = error.message || "Search failed";
        const details = error.response?.data || null;
        res.status(status).json({ status: false, statusCode: status, message, details });
    }
};
