import { Request, Response, NextFunction } from "express";
import { isValidTripJackPayload } from "../middleware/flightPayloadHandler";
import { searchFlightsForMultipleDays } from "../services/multiDaySearch.service";

export const searchFlightsForWeek = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        console.log("Multi-day search payload:", req.body);
        const payload = req.body;

        if (!isValidTripJackPayload(payload)) {
            return res.status(400).json({
                success: false,
                message: "Invalid search payload..."
            });
        }

        // Get the single date from payload
        const baseDate = payload.searchQuery.routeInfos[0].travelDate;
        const startDate = new Date(baseDate);
        
        // Calculate end date as start date + 6 days (total 7 days)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        const results = await searchFlightsForMultipleDays(
            payload,
            startDate,
            endDate
        );

        const cheapestDay = findCheapestDay(results);

        return res.status(200).json({
            success: true,
            data: {
                dailyResults: results,
                cheapest: cheapestDay,
                summary: {
                    totalDaysSearched: results.length,
                    dateRange: {
                        start: startDate.toISOString().split('T')[0],
                        end: endDate.toISOString().split('T')[0]
                    }
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

const findCheapestDay = (results: any[]) => {
    let cheapest = null;
    
    for (const dayResult of results) {
        if (dayResult.flightData && dayResult.flightData.length > 0) {
            const dayMinPrice = Math.min(
                ...dayResult.flightData.map((flight: any) => 
                    flight?.fare?.totalPrice || Infinity
                )
            );
            
            if (!cheapest || dayMinPrice < cheapest.price) {
                cheapest = {
                    date: dayResult.date,
                    price: dayMinPrice,
                    flightCount: dayResult.flightData.length,
                    airlines: [...new Set(dayResult.flightData.map((f: any) => f.airline?.name))]
                };
            }
        }
    }
    
    return cheapest;
};