import { Request, Response } from "express";
import airportDataService from "../services/airportData.service";

export const searchAirportsCsvController = (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        
        if (!query || query.trim().length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const lowerQuery = query.toLowerCase();
        const airports = airportDataService.getAirports();

        const filtered = airports.filter((a: any) => {
            if (a.iata && a.iata !== "\\N" && a.iata.toLowerCase().includes(lowerQuery)) return true;
            if (a.city && a.city.toLowerCase().includes(lowerQuery)) return true;
            if (a.name && a.name.toLowerCase().includes(lowerQuery)) return true;
            if (a.country && a.country.toLowerCase().includes(lowerQuery)) return true;
            if (a.keywords && a.keywords.toLowerCase().includes(lowerQuery)) return true;
            return false;
        }).sort((a: any, b: any) => {
            // 1. Exact IATA match
            const aIataMatch = a.iata && a.iata.toLowerCase() === lowerQuery ? 1 : 0;
            const bIataMatch = b.iata && b.iata.toLowerCase() === lowerQuery ? 1 : 0;
            if (aIataMatch !== bIataMatch) return bIataMatch - aIataMatch;

            // 2. City or Keywords match
            const aCityMatch = (a.city && a.city.toLowerCase().includes(lowerQuery)) || (a.keywords && a.keywords.toLowerCase().includes(lowerQuery)) ? 1 : 0;
            const bCityMatch = (b.city && b.city.toLowerCase().includes(lowerQuery)) || (b.keywords && b.keywords.toLowerCase().includes(lowerQuery)) ? 1 : 0;
            if (aCityMatch !== bCityMatch) return bCityMatch - aCityMatch;

            // 3. Has valid IATA code
            const aHasIata = a.iata ? 1 : 0;
            const bHasIata = b.iata ? 1 : 0;
            if (aHasIata !== bHasIata) return bHasIata - aHasIata;

            // 4. Commercial airport size (large > medium > small)
            const typeScore = (type: string) => {
                if (type === "large_airport") return 3;
                if (type === "medium_airport") return 2;
                if (type === "small_airport") return 1;
                return 0;
            };
            const aScore = typeScore(a.type);
            const bScore = typeScore(b.type);
            if (aScore !== bScore) return bScore - aScore;

            return 0;
        }).slice(0, 20);

        return res.status(200).json({
            success: true,
            data: filtered
        });
    } catch (error: any) {
        console.error("Error in searchAirportsCsvController:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to search airports",
            error: error.message
        });
    }
};
