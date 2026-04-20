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

    private isMockMode(): boolean {
        return env.tripJack.apiKey === "MOCK_TEST_KEY" || env.enableMocks;
    }

    // ─── Location APIs ──────────────────────────────────────────────────────

    async googlePlaces(input: string): Promise<any> {
        if (this.isMockMode()) {
            return {
                success: true,
                data: {
                    places: [
                        { id: "MOCK-PLACE-1", displayLabel: "Mock Airport, Delhi", value: "MOCK-PLACE-1" },
                        { id: "MOCK-PLACE-2", displayLabel: "Mock Central Park", value: "MOCK-PLACE-2" }
                    ]
                }
            };
        }
        try {
            const res = await tripJackCabsClient.post("/cabs/v1/google-places", { input });
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GooglePlaces");
        }
    }

    async getLatLong(placeId: string): Promise<any> {
        if (this.isMockMode()) {
            return {
                success: true,
                data: {
                    location: { lat: 28.55, lng: 77.08 },
                    address: { city: "Delhi", country: "India" }
                }
            };
        }
        try {
            const res = await tripJackCabsClient.post("/cabs/v1/get-lat-long", { placeId });
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetLatLong");
        }
    }

    // ─── Quote API ──────────────────────────────────────────────────────────

    async getQuotes(payload: any): Promise<any> {
        if (this.isMockMode()) {
            return {
                status: { success: true, code: 200 },
                data: {
                    quotesInfo: [{
                        vehicleType: "Sedan",
                        quoteList: [{
                            quoteId: "MOCK-QUOTE-001",
                            totalAmount: 1250,
                            currency: "INR",
                            vehicleType: "Sedan"
                        }]
                    }]
                }
            };
        }

        // Add correlationId for real-world tracking
        const requestPayload = {
            ...payload,
            correlationId: payload.correlationId || uuidv4()
        };

        try {
            const res = await tripJackCabsClient.post("/cabs/v2/quotes", requestPayload);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetQuotes");
        }
    }

    // ─── Booking APIs ───────────────────────────────────────────────────────

    async createBooking(payload: any): Promise<any> {
        if (this.isMockMode()) {
            return {
                status: { success: true, code: 200 },
                data: {
                    bookingId: "TJ-CABS-MOCK-789",
                    status: "SUCCESS"
                }
            };
        }

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
        if (this.isMockMode()) {
            return {
                success: true,
                data: [{
                    bookingId: bookingIds,
                    status: "CONFIRMED",
                    journeyInfo: { pickupDate: "2026-06-23 09:00" },
                    passengerDetail: { firstName: "John", lastName: "Doe" }
                }]
            };
        }
        try {
            const res = await tripJackCabsClient.get(`/cabs/v1/booking/details?bookingIds=${bookingIds}`);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetBookingDetails");
        }
    }

    async createEmbeddedBooking(payload: any): Promise<any> {
        if (this.isMockMode()) {
            return {
                status: { success: true, code: 200 },
                data: { bookingId: "MOCK-EMB-123", status: "SUCCESS" }
            };
        }

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
        if (this.isMockMode()) {
            return {
                success: true,
                message: "Payment successfully created",
                data: { transactionId: "MOCK-TXN-456", status: "PAID" }
            };
        }

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
        if (this.isMockMode()) {
            return {
                success: true,
                data: {
                    bookingId,
                    amendmentType: type,
                    cancellationCharges: 500,
                    refundableAmount: 750
                }
            };
        }
        try {
            // Correlation ID usually passed as query param if supported, but cabs v1 might not use it for GET
            const res = await tripJackCabsClient.get(`/cabs/v1/amendment?bookingId=${bookingId}&type=${type}`);
            return res.data;
        } catch (err: any) {
            this.normaliseError(err, "GetAmendmentCharges");
        }
    }

    async processAmendment(payload: any): Promise<any> {
        if (this.isMockMode()) {
            return {
                success: true,
                data: {
                    bookingId: payload.bookingId,
                    amendmentStatus: "CANCELLED",
                    refundStatus: "PENDING"
                }
            };
        }

        const requestPayload = {
            ...payload,
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
