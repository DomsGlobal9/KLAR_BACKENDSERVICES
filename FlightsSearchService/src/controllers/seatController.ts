import { Request, Response, NextFunction } from "express";
import {
    getSeatMapFromTripJack,
    transformSeatMap,
    validateSeatRequest,
    getSeatsByType,
    groupSeatsByDeck
} from "../services/tripjackSeatService";

/**
 * Get seat map by booking ID
 */
export const getSeatMap = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { bookingId } = req.body;

        if (!validateSeatRequest(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request. Expected { bookingId: string }"
            });
        }

        console.log("📋 Getting seat map for booking ID:", bookingId);

        const seatData = await getSeatMapFromTripJack({ bookingId });

        if (!seatData.status?.success) {
            return res.status(400).json({
                success: false,
                message: "Seat API returned error",
                error: seatData
            });
        }

        const transformedData = transformSeatMap(seatData);

        return res.status(200).json({
            success: true,
            message: "Seat map fetched successfully",
            data: transformedData
        });

    } catch (error: any) {
        console.error("❌ Error in getSeatMap:", error);

        if (error.response?.status === 404) {
            return res.status(404).json({
                success: false,
                message: "Booking ID not found or expired"
            });
        }

        if (error.response?.status === 400) {
            return res.status(400).json({
                success: false,
                message: error.response?.data?.message || "Invalid booking ID"
            });
        }

        next(error);
    }
};

/**
 * Get available seats only
 */
export const getAvailableSeats = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { bookingId } = req.body;

        if (!validateSeatRequest(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request. Expected { bookingId: string }"
            });
        }

        const seatData = await getSeatMapFromTripJack({ bookingId });

        if (!seatData.status?.success) {
            return res.status(400).json({
                success: false,
                message: "Seat API returned error"
            });
        }

        const transformedData = transformSeatMap(seatData);

        const availableSeats = transformedData.flights.map(flight => ({
            segmentId: flight.segmentId,
            availableSeats: flight.seatMap.rows.flatMap(row =>
                row.seats.filter(seat => !seat.isBooked)
            ),
            summary: {
                totalAvailable: flight.seatMap.summary.availableSeats,
                priceRange: flight.seatMap.summary.priceRange
            }
        }));

        return res.status(200).json({
            success: true,
            message: "Available seats fetched successfully",
            data: availableSeats
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get seat map with recommendations
 */
export const getSeatMapWithRecommendations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { bookingId, preferences } = req.body;

        if (!validateSeatRequest(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request. Expected { bookingId: string }"
            });
        }

        const seatData = await getSeatMapFromTripJack({ bookingId });

        if (!seatData.status?.success) {
            return res.status(400).json({
                success: false,
                message: "Seat API returned error"
            });
        }

        const transformedData = transformSeatMap(seatData);

        const recommendations = transformedData.flights.map(flight => {
            const allSeats = flight.seatMap.rows.flatMap(row => row.seats);

            const preferredSeats = getSeatsByType(
                allSeats.filter(s => !s.isBooked),
                preferences?.types || []
            );

            const cheapestSeats = [...allSeats]
                .filter(s => !s.isBooked)
                .sort((a, b) => a.price - b.price)
                .slice(0, 5);

            const bestValueSeats = [...allSeats]
                .filter(s => !s.isBooked && s.features.length > 0)
                .sort((a, b) => {
                    const valueA = a.features.length / (a.price || 1);
                    const valueB = b.features.length / (b.price || 1);
                    return valueB - valueA;
                })
                .slice(0, 5);

            return {
                segmentId: flight.segmentId,
                recommendations: {
                    preferred: preferredSeats.slice(0, 5),
                    cheapest: cheapestSeats,
                    bestValue: bestValueSeats
                }
            };
        });

        return res.status(200).json({
            success: true,
            message: "Seat map with recommendations fetched successfully",
            data: {
                ...transformedData,
                recommendations
            }
        });

    } catch (error) {
        next(error);
    }
};