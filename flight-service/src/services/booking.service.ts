import axios from "axios";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";
import { SimpleFrontendBookingPayload } from "../types/flightBook.types";
import { normalizeToTripJackBookingPayload } from "../normalizers/flightBooking.normalizer";


class BookingService {

    /**
     * Main booking method (Instant or Hold)
     * @param frontendPayload - Simple readable payload from frontend
     * @param isInstantBook - true = Instant Ticket, false = Hold (Block)
     */
    async bookFlight(
        frontendPayload: SimpleFrontendBookingPayload,
        isInstantBook: boolean = true
    ) {

        const normalized = normalizeToTripJackBookingPayload(frontendPayload, isInstantBook);

        if (!normalized.success || !normalized.tripJackPayload) {
            throw {
                status: 400,
                message: "Booking validation failed",
                errors: normalized.errors,
            };
        }

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.BOOK}`;

        const response = await axios.post(
            url,
            normalized.tripJackPayload,
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
                // timeout: 20000,
            }
        );

        const rawData = response.data;

        const mappedResponse = TripjackFieldMapper.map(rawData);

        return mappedResponse;
    }

    /**
     * Confirm Hold Booking (after fare-validate)
     */
    async confirmHoldBooking(bookingId: string) {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.CONFIRM_BOOK}`;

        const response = await axios.post(
            url,
            { bookingId },
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
            }
        );

        return TripjackFieldMapper.map(response.data);
    }

    /**
     * Confirm Fare Before Ticketing (for Hold flow)
     */
    async confirmFareBeforeTicketing(bookingId: string) {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.FARE_VALIDATE}`;

        const response = await axios.post(
            url,
            { bookingId },
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: tripjackConfig.API_KEY,
                },
            }
        );

        return TripjackFieldMapper.map(response.data);
    }
}

export default new BookingService();