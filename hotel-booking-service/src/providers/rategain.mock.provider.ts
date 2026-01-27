import precheckMock from "../mocks/precheck.mock.json";
import commitMock from "../mocks/commit.mock.json";

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
