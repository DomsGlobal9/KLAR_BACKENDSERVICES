import { Request, Response } from "express";
import { countryService } from "../services/country.service";

export const countryController = async (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.search || req.query.query || req.body?.q || req.body?.search || "") as string;
        const data = countryService.search(query);
        res.json({
            status: true,
            count: data.length,
            data,
        });
    } catch (error: any) {
        console.error("[Insurance][Country Search Error]", error?.message || error);
        res.status(500).json({
            status: false,
            message: error?.message || "Failed to search countries",
        });
    }
};
