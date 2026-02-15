import axios from "axios";
import { envConfig, getTripJackEndpoint } from "../config/env";
import { getCache, setCache } from "./redisService";
import { TripJackRawModel } from "../models/tripJackRaw.model";
import {
    SeatMapRequest,
    SeatMapResponse,
    TransformedSeatMap,
    TransformedFlightSeatMap,
    SeatInfo,
    TransformedSeat,
    TransformedSeatRow
} from "../interface/flight/seat.interface";

/**
 * Get seat map from TripJack using booking ID
 */
export const getSeatMapFromTripJack = async (payload: SeatMapRequest): Promise<SeatMapResponse> => {
    const cacheKey = `seat:${payload.bookingId}`;

    const cached = await getCache(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
        const url = getTripJackEndpoint('SEAT');

        console.log("🔍 Calling TripJack Seat API:", {
            url,
            bookingId: payload.bookingId
        });

        const response = await axios.post(
            url,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: envConfig.TRIPJACK.API_KEY,
                },
                timeout: envConfig.TRIPJACK.TIMEOUT,
            }
        );


        await TripJackRawModel.create({
            provider: "TRIPJACK",
            endpoint: "SEAT",
            requestPayload: payload,
            responsePayload: response.data,
            searchKey: cacheKey,
        }).catch((err) => {
            console.error("Failed to store TripJack raw data", err);
        });


        await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);

        return response.data as SeatMapResponse;
    } catch (error: any) {
        console.error("❌ TripJack Seat API Error:", {
            endpoint: getTripJackEndpoint('SEAT'),
            bookingId: payload.bookingId,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw error;
    }
};

/**
 * Transform seat map response to frontend-friendly format
 */
export const transformSeatMap = (
    response: SeatMapResponse
): TransformedSeatMap => {

    const transformedFlights: TransformedFlightSeatMap[] = [];


    Object.entries(response.tripSeatMap.tripSeat).forEach(([segmentId, tripSeat]) => {

        const seatsByRow = new Map<number, TransformedSeat[]>();
        let totalSeats = 0;
        let availableSeats = 0;
        let bookedSeats = 0;
        let blockedSeats = 0;
        let legroomSeats = 0;
        let aisleSeats = 0;
        let windowSeats = 0;
        let minPrice = Infinity;
        let maxPrice = -Infinity;


        tripSeat.sInfo.forEach((seat: SeatInfo) => {
            totalSeats++;


            if (seat.isBooked) {
                bookedSeats++;
            } else {
                availableSeats++;
            }

            if (seat.isLegroom) legroomSeats++;
            if (seat.isAisle) aisleSeats++;


            const isWindow = seat.seatPosition.column === 1 || seat.seatPosition.column === 7;
            if (isWindow) windowSeats++;


            if (seat.amount > 0) {
                minPrice = Math.min(minPrice, seat.amount);
                maxPrice = Math.max(maxPrice, seat.amount);
            }


            const rowNum = seat.seatPosition.row;
            if (!seatsByRow.has(rowNum)) {
                seatsByRow.set(rowNum, []);
            }

            const features: string[] = [];
            if (seat.isLegroom) features.push('legroom');
            if (seat.isAisle) features.push('aisle');
            if (isWindow) features.push('window');
            if (seat.isExit) features.push('exit');

            seatsByRow.get(rowNum)!.push({
                seatNo: seat.seatNo,
                row: seat.seatPosition.row,
                column: seat.seatPosition.column,
                isBooked: seat.isBooked,
                isAvailable: !seat.isBooked,
                isLegroom: seat.isLegroom,
                isAisle: seat.isAisle,
                isWindow: isWindow,
                isExit: seat.isExit,
                price: seat.amount,
                currency: 'INR',
                features
            });
        });


        const rows: TransformedSeatRow[] = Array.from(seatsByRow.entries())
            .map(([rowNumber, seats]) => ({
                rowNumber,
                seats: seats.sort((a, b) => a.column - b.column)
            }))
            .sort((a, b) => a.rowNumber - b.rowNumber);

        transformedFlights.push({
            segmentId,
            seatMap: {
                rows,
                summary: {
                    totalSeats,
                    availableSeats,
                    bookedSeats,
                    blockedSeats,
                    legroomSeats,
                    aisleSeats,
                    windowSeats,
                    priceRange: {
                        min: minPrice === Infinity ? 0 : minPrice,
                        max: maxPrice === -Infinity ? 0 : maxPrice
                    }
                }
            }
        });
    });

    return {
        bookingId: response.bookingId,
        flights: transformedFlights,
        status: response.status
    };
};

/**
 * Validate seat map request
 */
export const validateSeatRequest = (bookingId: any): bookingId is string => {
    return typeof bookingId === 'string' && bookingId.trim().length > 0;
};

/**
 * Group seats by deck (for aircraft with multiple decks)
 */
export const groupSeatsByDeck = (seats: TransformedSeat[]): {
    upperDeck: TransformedSeat[];
    mainDeck: TransformedSeat[];
} => {

    const upperDeck = seats.filter(seat => seat.row <= 5);
    const mainDeck = seats.filter(seat => seat.row > 5);

    return { upperDeck, mainDeck };
};

/**
 * Get available seats by type
 */
export const getSeatsByType = (
    seats: TransformedSeat[],
    types: ('legroom' | 'aisle' | 'window' | 'exit')[]
): TransformedSeat[] => {
    return seats.filter(seat => {
        if (seat.isBooked) return false;
        return types.every(type => {
            switch (type) {
                case 'legroom': return seat.isLegroom === true;
                case 'aisle': return seat.isAisle === true;
                case 'window': return seat.isWindow === true;
                case 'exit': return seat.isExit === true;
                default: return true;
            }
        });
    });
};