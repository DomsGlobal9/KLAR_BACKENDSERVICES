const precheckMock = {
    "bookingReference": "PRECHECK_12345",
    "price": 9500,
    "currency": "INR",
    "available": true,
    "cancellationPolicy": "Free cancellation till 24 hours"
};

const commitMock = {
    "bookingId": "BOOKING_987654",
    "status": "CONFIRMED",
    "hotelName": "Taj Deccan",
    "checkin": "2025-10-01",
    "checkout": "2025-10-02",
    "totalPrice": 9500,
    "currency": "INR"
};

export class RateGainMockProvider {
    async precheck(_payload: any) {
        return {
            status: true,
            data: precheckMock
        };
    }

    async commit(_payload: any) {
        return {
            status: true,
            data: commitMock
        };
    }

    async cancel(_payload: any) {
        return {
            status: true,
            data: {
                message: "Reservation cancelled successfully (MOCK)",
                cancellationId: "MOCK-CANCEL-123"
            }
        };
    }

    async getSpecialRequests() {
        return {
            status: true,
            data: [
                { code: "SR1", description: "Late Check-out" },
                { code: "SR2", description: "Early Check-in" },
                { code: "SR3", description: "Non-smoking Room" }
            ]
        };
    }
}
