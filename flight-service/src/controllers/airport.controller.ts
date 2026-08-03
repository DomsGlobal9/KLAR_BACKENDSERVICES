import { Request, Response } from "express";
import fs from "fs";
import path from "path";

// In-memory cache for airports
let airportsCache: any[] | null = null;

const loadAirports = () => {
    if (airportsCache) return airportsCache;
    
    try {
        const filePath = path.join(process.cwd(), "node_modules", "airport-codes", "airports.json");
        const fileData = fs.readFileSync(filePath, "utf-8");
        airportsCache = JSON.parse(fileData);
    } catch (error) {
        console.error("Error loading airports:", error);
        airportsCache = [];
    }
    return airportsCache!;
};

export const searchAirportsController = (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        
        if (!query || query.trim().length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const lowerQuery = query.toLowerCase();
        const airports = loadAirports();

        const filtered = airports.filter((a: any) => {
            // Some entries might have empty iata or \N for missing values
            if (a.iata && a.iata !== "\\N" && a.iata.toLowerCase().includes(lowerQuery)) return true;
            if (a.city && a.city.toLowerCase().includes(lowerQuery)) return true;
            if (a.name && a.name.toLowerCase().includes(lowerQuery)) return true;
            if (a.country && a.country.toLowerCase().includes(lowerQuery)) return true;
            return false;
        }).slice(0, 20); // Top 20 results

        return res.status(200).json({
            success: true,
            data: filtered
        });
    } catch (error: any) {
        console.error("Error in searchAirportsController:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to search airports",
            error: error.message
        });
    }
};
