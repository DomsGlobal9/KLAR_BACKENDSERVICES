import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";
import RedisCacheService from "../cache/redisCache.service";

/** Cache key for a booking's seat map, used to price seat SSR at book time. */
export const seatMapCacheKey = (bookingId: string) => `seatmap:${bookingId}`;

/** Seat maps live as long as a review session plausibly can. */
const SEAT_MAP_TTL_SECONDS = 1800;

class SeatService {

    async getSeats(bookingId: string) {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEAT}`;

        try {
            const response = await axios.post(
                url,
                { bookingId },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                    // timeout: 15000,
                }
            );
            

            const rawData = response.data;

            const mappedData = TripjackFieldMapper.map(rawData);

            // Retain the seat map so a selected seat can be re-priced from
            // TripJack's own numbers at book time rather than trusted from the
            // browser (H-4). Best-effort: a cache failure must not break seat
            // display, and the booking path re-fetches when it finds nothing.
            try {
                await RedisCacheService.set(
                    seatMapCacheKey(bookingId),
                    mappedData,
                    SEAT_MAP_TTL_SECONDS
                );
            } catch (cacheError: any) {
                console.warn("[Seat] Could not cache seat map >>>", {
                    bookingId,
                    message: cacheError?.message,
                });
            }

            return {
                data: mappedData
            };

        } catch (error: any) {
            console.error("Seat Service ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new SeatService();