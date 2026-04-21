
import { Request, Response, NextFunction } from "express";
import { searchFromTripJack } from "../services/tripjackService";
import { extractSearchParams } from "../utils/searchParamsExtractor";
import { MultiCityCursorPagination } from "../utils/pagination/multiCityCursorPagination";
import { isValidMultiCityPayload } from "../utils/multiCity/multiCityValidator";
import { transformMultiCityResponse } from "../utils/multiCity/multiCityTransformer";

// In-memory storage for sessions (replace with Redis or DB in production)
const sessionStorage: Map<string, {
    tripInfos: any;
    legs: any[];
    searchParams: any;
    timestamp: number;
}> = new Map();

// Session expiry time (30 minutes)
const SESSION_EXPIRY = 30 * 60 * 1000;

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, data] of sessionStorage.entries()) {
        if (now - data.timestamp > SESSION_EXPIRY) {
            sessionStorage.delete(sessionId);
        }
    }
}, 60 * 1000);

export const searchMultiCity = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const payload = req.body;
        const paginationOptions = MultiCityCursorPagination.validateOptions(req.query);

        // Validate payload for multi-city
        if (!isValidMultiCityPayload(payload)) {
            return res.status(400).json({
                success: false,
                message: "Invalid multi-city search payload. Need at least 2 routes."
            });
        }

        // Generate session ID
        const sessionId = req.headers['x-session-id'] as string ||
            `multi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Check if new search
        const isNewSearch = req.headers['x-new-search'] === 'true' || !req.headers['x-session-id'];

        if (isNewSearch && req.headers['x-session-id']) {
            sessionStorage.delete(req.headers['x-session-id'] as string);
        }

        // Fetch from TripJack
        const data = await searchFromTripJack(payload);

        // Get trip infos
        const tripInfos = data.searchResult?.tripInfos || {};

        // Transform to structured legs with flights
        const legs = transformMultiCityResponse(tripInfos);

        // Store in session
        sessionStorage.set(sessionId, {
            tripInfos: tripInfos,
            legs: legs,
            searchParams: extractSearchParams(payload),
            timestamp: Date.now()
        });

        // Apply pagination per leg
        const paginatedResult = MultiCityCursorPagination.paginate(legs, paginationOptions);

        // Extract search params
        const searchParams = extractSearchParams(payload);

        return res.status(200).json({
            success: true,
            message: "Multi-city flights searched successfully",
            sessionId,
            data: {
                searchType: 'MULTI_CITY',
                routeCount: payload.searchQuery.routeInfos.length,
                legs: paginatedResult.data,
                hasMore: paginatedResult.hasMore,
                searchParams,
                appliedSort: {
                    sortBy: paginationOptions.sortBy,
                    sortOrder: paginationOptions.sortOrder
                },
                appliedLimit: paginationOptions.limit
            }
        });

    } catch (error) {
        console.error("Multi-city search error:", error);
        next(error);
    }
};

export const getMultiCityNextPage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { sessionId } = req.params;
        const { legKey, cursor } = req.query;
        const paginationOptions = MultiCityCursorPagination.validateOptions(req.query);

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID is required"
            });
        }

        // Get session data
        const sessionData = sessionStorage.get(sessionId);
        if (!sessionData) {
            return res.status(404).json({
                success: false,
                message: "Session expired or not found. Please search again."
            });
        }

        // Find the leg
        const legIndex = sessionData.legs.findIndex(leg => leg.legKey === legKey);
        if (legIndex === -1) {
            return res.status(404).json({
                success: false,
                message: `Leg ${legKey} not found`
            });
        }

        const currentLeg = sessionData.legs[legIndex];

        // Sort flights
        const sortedFlights = MultiCityCursorPagination.sortFlights(
            currentLeg.flights,
            paginationOptions.sortBy!,
            paginationOptions.sortOrder!
        );

        // Find start index from cursor
        let startIndex = 0;
        if (cursor) {
            const cursorData = MultiCityCursorPagination.decodeCursor(cursor as string);
            if (cursorData) {
                const index = sortedFlights.findIndex(flight => flight.flightId === cursorData.flightId);
                if (index !== -1) {
                    startIndex = index + 1;
                }
            }
        }

        // Paginate
        const paginatedFlights = sortedFlights.slice(startIndex, startIndex + paginationOptions.limit);
        const hasMore = startIndex + paginationOptions.limit < sortedFlights.length;
        const nextCursor = hasMore
            ? MultiCityCursorPagination.generateCursor(paginatedFlights[paginatedFlights.length - 1], paginationOptions.sortBy!, paginationOptions.sortOrder!)
            : null;

        // Update session with new cursor position for this leg
        sessionData.legs[legIndex] = {
            ...currentLeg,
            currentCursor: nextCursor,
            currentPageStartIndex: startIndex
        };
        sessionStorage.set(sessionId, sessionData);

        return res.status(200).json({
            success: true,
            message: "Next page loaded successfully",
            data: {
                legKey: legKey,
                legNumber: currentLeg.legNumber,
                flights: paginatedFlights,
                nextCursor: nextCursor,
                hasMore: hasMore,
                totalFlights: sortedFlights.length,
                currentPage: Math.floor(startIndex / paginationOptions.limit) + 1
            }
        });

    } catch (error) {
        console.error("Get next page error:", error);
        next(error);
    }
};

export const getMultiCityFlightBySegmentId = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { sessionId, segmentId } = req.params;

        if (!sessionId || !segmentId) {
            return res.status(400).json({
                success: false,
                message: "Session ID and Segment ID are required"
            });
        }

        // Get session data
        const sessionData = sessionStorage.get(sessionId);
        if (!sessionData) {
            return res.status(404).json({
                success: false,
                message: "Session expired or not found. Please search again."
            });
        }

        // Find flight by segment ID
        let foundFlight: any = null;
        let foundLeg: any = null;

        for (const leg of sessionData.legs) {
            const flight = leg.flights.find((f: any) => f.segmentId.includes(segmentId));
            if (flight) {
                foundFlight = flight;
                foundLeg = leg;
                break;
            }
        }

        if (!foundFlight) {
            return res.status(404).json({
                success: false,
                message: "Flight not found for the given segment ID"
            });
        }

        // Get full flight details from raw TripJack data
        const tripInfos = sessionData.tripInfos;
        const legData = tripInfos[foundLeg.legKey];

        let fullFlightDetails = null;

        if (legData && Array.isArray(legData)) {
            // Find the specific flight in the leg data
            const flightData = legData.find((item: any) => {
                const segments = item.sI || [];
                return segments.some((seg: any) => seg.id === segmentId);
            });

            if (flightData) {
                fullFlightDetails = {
                    segments: flightData.sI,
                    fareOptions: flightData.totalPriceList,
                    airFlowType: flightData.airFlowType
                };
            }
        }

        return res.status(200).json({
            success: true,
            message: "Flight details retrieved successfully",
            data: {
                flight: foundFlight,
                leg: {
                    legNumber: foundLeg.legNumber,
                    legKey: foundLeg.legKey
                },
                fullDetails: fullFlightDetails,
                segmentId: segmentId
            }
        });

    } catch (error) {
        console.error("Get flight by segment ID error:", error);
        next(error);
    }
};

export const getMultiCityLegFlights = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { sessionId, legKey } = req.params;
        const paginationOptions = MultiCityCursorPagination.validateOptions(req.query);

        if (!sessionId || !legKey) {
            return res.status(400).json({
                success: false,
                message: "Session ID and Leg Key are required"
            });
        }

        // Get session data
        const sessionData = sessionStorage.get(sessionId);
        if (!sessionData) {
            return res.status(404).json({
                success: false,
                message: "Session expired or not found. Please search again."
            });
        }

        // Find the leg
        const leg = sessionData.legs.find(l => l.legKey === legKey);
        if (!leg) {
            return res.status(404).json({
                success: false,
                message: `Leg ${legKey} not found`
            });
        }

        // Sort flights
        const sortedFlights = MultiCityCursorPagination.sortFlights(
            leg.flights,
            paginationOptions.sortBy!,
            paginationOptions.sortOrder!
        );

        // Get cursor from query
        const cursor = req.query.cursor as string | undefined;

        // Find start index
        let startIndex = 0;
        if (cursor) {
            const cursorData = MultiCityCursorPagination.decodeCursor(cursor);
            if (cursorData) {
                const index = sortedFlights.findIndex(flight => flight.flightId === cursorData.flightId);
                if (index !== -1) {
                    startIndex = index + 1;
                }
            }
        }

        // Paginate
        const paginatedFlights = sortedFlights.slice(startIndex, startIndex + paginationOptions.limit);
        const hasMore = startIndex + paginationOptions.limit < sortedFlights.length;
        const nextCursor = hasMore
            ? MultiCityCursorPagination.generateCursor(paginatedFlights[paginatedFlights.length - 1], paginationOptions.sortBy!, paginationOptions.sortOrder!)
            : null;

        return res.status(200).json({
            success: true,
            message: "Leg flights retrieved successfully",
            data: {
                legKey: leg.legKey,
                legNumber: leg.legNumber,
                flights: paginatedFlights,
                nextCursor: nextCursor,
                hasMore: hasMore,
                totalFlights: sortedFlights.length,
                currentPage: Math.floor(startIndex / paginationOptions.limit) + 1,
                pageSize: paginationOptions.limit
            }
        });

    } catch (error) {
        console.error("Get leg flights error:", error);
        next(error);
    }
};

export const clearMultiCitySession = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID is required"
            });
        }

        const deleted = sessionStorage.delete(sessionId);

        return res.status(200).json({
            success: true,
            message: deleted ? "Session cleared successfully" : "Session not found"
        });

    } catch (error) {
        next(error);
    }
};