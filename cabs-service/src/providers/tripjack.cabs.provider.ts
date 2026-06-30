import { tripJackCabsClient } from "../clients/tripjack.client";
import { env } from "../config/env";
import { v4 as uuidv4 } from "uuid";

/**
 * TripJack Cabs API Provider
 * Wraps all Cabs endpoints per documentation.
 */
export class TripJackCabsProvider {

    private normaliseError(error: any, label: string): never {
        const status = error.response?.status || 500;
        const data = error.response?.data;
        const message = data?.message || data?.error?.message || error.message || label;

        console.error(`[Cabs][${label}] HTTP ${status}:`, JSON.stringify(data || message));
        throw { status, message, data };
    }


    // ─── Location APIs ──────────────────────────────────────────────────────

    async googlePlaces(input: string): Promise<any> {
        try {
            const res = await tripJackCabsClient.post("/cabs/v1/google-places", { input });
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GooglePlaces");
        }
    }

    async getLatLong(placeId: string): Promise<any> {
        try {
            const res = await tripJackCabsClient.post("/cabs/v1/get-lat-long", { placeId });
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetLatLong");
        }
    }

    // ─── Quote API ──────────────────────────────────────────────────────────

    async getQuotes(payload: any): Promise<any> {
        // Add correlationId for real-world tracking
        const requestPayload = {
            ...payload,
            correlationId: payload.correlationId || uuidv4()
        };

        try {
            console.log(`[Cabs][GetQuotes] Request Payload:`, JSON.stringify(requestPayload, null, 2));
            const res = await tripJackCabsClient.post("/cabs/v2/quotes", requestPayload);
            console.log(`[Cabs][GetQuotes] Response: SUCCESS, found ${res.data?.data?.quotesInfo?.length || 0} categories.`);
            return res.data;
        } catch (err: any) {
            // Handle 404 "No Cabs Found!" as a graceful empty result
            const status = err.response?.status;
            const data = err.response?.data;
            const message = data?.message || data?.error?.message;

            console.error(`[Cabs][GetQuotes] Error Status: ${status}, Message: ${message}`);
            if (data) console.error(`[Cabs][GetQuotes] Error Data:`, JSON.stringify(data, null, 2));

            if (status === 404 && message === "No Cabs Found!") {
                console.log("[Cabs][GetQuotes] No cabs found. Returning empty results.");
                return {
                    success: true,
                    data: {
                        quotesInfo: []
                    }
                };
            }

            this.normaliseError(err, "GetQuotes");
        }
    }

    // ─── Booking APIs ───────────────────────────────────────────────────────

    async createBooking(payload: any): Promise<any> {

        const requestPayload = {
            ...payload,
            correlationId: payload.correlationId || uuidv4()
        };

        try {
            const res = await tripJackCabsClient.post("/cabs/v2/booking", requestPayload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "CreateBooking");
        }
    }

    async getBookingDetails(bookingIds: string): Promise<any> {
        try {
            const res = await tripJackCabsClient.get(`/cabs/v1/booking/details?bookingIds=${bookingIds}`);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetBookingDetails");
        }
    }

    async createEmbeddedBooking(payload: any): Promise<any> {

        const requestPayload = {
            ...payload,
            correlationId: payload.correlationId || uuidv4()
        };

        try {
            const res = await tripJackCabsClient.post("/cabs/v2/embedded/booking", requestPayload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "EmbeddedBooking");
        }
    }

    // ─── Payment API ────────────────────────────────────────────────────────

    async createPayment(payload: any): Promise<any> {

        const requestPayload = {
            ...payload,
            correlationId: payload.correlationId || uuidv4()
        };

        try {
            const res = await tripJackCabsClient.post("/cabs/v1/payment/create", requestPayload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "CreatePayment");
        }
    }

    // ─── Amendment APIs ─────────────────────────────────────────────────────

    async getAmendmentCharges(bookingId: string, type: string = "CANCELLATION"): Promise<any> {
        try {
            // Correlation ID usually passed as query param if supported, but cabs v1 might not use it for GET
            const res = await tripJackCabsClient.get(`/cabs/v1/amendment?bookingId=${bookingId}&type=${type}`);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetAmendmentCharges");
        }
    }

    async processAmendment(payload: any): Promise<any> {

        const requestPayload = {
            ...payload,
            agencyId: env.tripJack.agencyId,
            correlationId: payload.correlationId || uuidv4()
        };

        try {
            const res = await tripJackCabsClient.post("/cabs/v1/amendment", requestPayload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "ProcessAmendment");
        }
    }
}

export const tripJackCabsProvider = new TripJackCabsProvider();
