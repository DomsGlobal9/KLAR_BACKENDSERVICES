import { Request, Response, NextFunction } from "express";
import { SearchSession, ISearchSession } from "../models/SearchSession";
import mongoose from "mongoose";

/**
 * Create a new search session
 */
export const createSearchSession = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const data = req.body.searchQuery || req.body;
        const {
            userId,
            cabinClass,
            paxInfo,
            searchModifiers,
            preferredAirlines,
            routeInfos,
        } = data;

        // Validate routes
        if (!routeInfos || !Array.isArray(routeInfos) || routeInfos.length === 0) {
            res.status(400).json({
                success: false,
                message: "At least one route is required",
            });
            return;
        }

        // Create search session
        const searchSession = new SearchSession({
            userId: userId || null,
            cabinClass: cabinClass || "ECONOMY",
            paxInfo: {
                adult: paxInfo?.adult || paxInfo?.ADULT || 1,
                child: paxInfo?.child || paxInfo?.CHILD || 0,
                infant: paxInfo?.infant || paxInfo?.INFANT || 0,
            },
            searchModifiers: {
                isDirectFlight: searchModifiers?.isDirectFlight || false,
                isConnectingFlight: searchModifiers?.isConnectingFlight !== false,
                pft: searchModifiers?.pft || "REGULAR",
            },
            preferredAirlines: preferredAirlines || [],
            routeInfos: routeInfos.map((route: any, index: number) => ({
                from: route.from || route.fromCityOrAirport?.code,
                to: route.to || route.toCityOrAirport?.code,
                travelDate: new Date(route.travelDate),
                routeIndex: route.routeIndex ?? index,
            })),
        });

        await searchSession.save();

        res.status(201).json({
            success: true,
            message: "Search session created successfully",
            data: {
                sessionId: searchSession._id,
                searchSession,
            },
        });
    } catch (error: any) {
        console.error("Error creating search session:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create search session",
        });
    }
};

/**
 * Get search session by ID
 */
export const getSearchSession = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(String(sessionId))) {
            res.status(400).json({
                success: false,
                message: "Invalid session ID",
            });
            return;
        }

        const searchSession = await SearchSession.findById(String(sessionId));

        if (!searchSession) {
            res.status(404).json({
                success: false,
                message: "Search session not found",
            });
            return;
        }

        // Check if expired
        if (searchSession.isExpired()) {
            res.status(410).json({
                success: false,
                message: "Search session has expired",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Search session retrieved successfully",
            data: searchSession,
        });
    } catch (error: any) {
        console.error("Error fetching search session:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch search session",
        });
    }
};

/**
 * Get all search sessions for a user
 */
export const getUserSearchSessions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userId } = req.params;
        const { limit = 10, page = 1 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(String(userId))) {
            res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
            return;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const searchSessions = await SearchSession.find({
            userId: new mongoose.Types.ObjectId(String(userId)),
            expiresAt: { $gt: new Date() },
        })
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await SearchSession.countDocuments({
            userId: new mongoose.Types.ObjectId(String(userId)),
            expiresAt: { $gt: new Date() },
        });

        res.status(200).json({
            success: true,
            message: "Search sessions retrieved successfully",
            data: {
                searchSessions,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (error: any) {
        console.error("Error fetching user search sessions:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch search sessions",
        });
    }
};

/**
 * Delete search session
 */
export const deleteSearchSession = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(String(sessionId))) {
            res.status(400).json({
                success: false,
                message: "Invalid session ID",
            });
            return;
        }

        const searchSession = await SearchSession.findByIdAndDelete(String(sessionId));

        if (!searchSession) {
            res.status(404).json({
                success: false,
                message: "Search session not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Search session deleted successfully",
        });
    } catch (error: any) {
        console.error("Error deleting search session:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete search session",
        });
    }
};

/**
 * Update search session expiry
 */
export const extendSearchSession = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { hours = 24 } = req.body;

        if (!mongoose.Types.ObjectId.isValid(String(sessionId))) {
            res.status(400).json({
                success: false,
                message: "Invalid session ID",
            });
            return;
        }

        const searchSession = await SearchSession.findById(String(sessionId));

        if (!searchSession) {
            res.status(404).json({
                success: false,
                message: "Search session not found",
            });
            return;
        }

        // Extend expiry
        searchSession.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        await searchSession.save();

        res.status(200).json({
            success: true,
            message: "Search session extended successfully",
            data: {
                expiresAt: searchSession.expiresAt,
            },
        });
    } catch (error: any) {
        console.error("Error extending search session:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to extend search session",
        });
    }
};
