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

export const searchReturnController = async (req: Request, res: Response) => {
    try {
        const validationResult = FlightSearchValidator.validate(req.body);

        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });
        }
        console.log("Validation Complete");

        if (validationResult.searchType !== "RETURN") {
            return res.status(400).json({
                success: false,
                message: "Only return search allowed in this endpoint",
            });
        }
        console.log("Validation search type found");

        const data = await searchService.searchReturn(req.body);

        return res.status(200).json({
            success: true,
            data,
            warnings: validationResult.warnings,
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Return search failed",
        });
    }
};

export const searchMulticityController = async (req: Request, res: Response) => {
    try {
        const validationResult = FlightSearchValidator.validate(req.body);

        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });
        }

        if (validationResult.searchType !== "MULTICITY") {
            return res.status(400).json({
                success: false,
                message: "Only multicity search allowed in this endpoint",
            });
        }

        const data = await searchService.searchMulticity(req.body);

        return res.status(200).json({
            success: true,
            data,
            warnings: validationResult.warnings,
        });

    } catch (error: any) {
        console.error("Multicity search error:", error?.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message: "Multicity search failed",
        });
    }
};

export const reissueSearchInitController = async (req: Request, res: Response) => {
    try {
        const data = await searchService.reissueSearchInit(req.body);

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error: any) {
        console.error("FULL ERROR >>>", error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message: error.response?.data || error.message
        });
    }
};


export const reissueSearchResultController = async (req: Request, res: Response) => {
    try {
        const { requestId } = req.body;

        const data = await searchService.reissueSearchResult(requestId);

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Reissue search result failed"
        });
    }
};
