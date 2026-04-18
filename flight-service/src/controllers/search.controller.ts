import { Request, Response } from "express";
import searchService from "../services/search.service";
import FlightSearchValidator from "../utils/flightSearchValidator";


export const searchOneWayController = async (req: Request, res: Response) => {
    try {
                
        const validationResult = FlightSearchValidator.validate(req.body);

        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });
        }

        if (validationResult.searchType !== "ONEWAY") {
            return res.status(400).json({
                success: false,
                message: "Only one-way search allowed in this endpoint",
            });
        }

        const data = await searchService.searchOneWay(req.body);

        return res.status(200).json({
            success: true,
            data,
            warnings: validationResult.warnings,
        });
    } catch (error: any) {
        console.error("Search error:", error?.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message: "Search failed",
        });
    }
};