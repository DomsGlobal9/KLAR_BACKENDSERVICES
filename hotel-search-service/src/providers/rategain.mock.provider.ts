const destinationsMock = {
    "status": true,
    "statusCode": 200,
    "body": [
        {
            "destCode": "HYD",
            "destName": "Hyderabad India",
            "countryCode": "IN",
            "countryName": "India"
        },
        {
            "destCode": "BLR",
            "destName": "Bangalore India",
            "countryCode": "IN",
            "countryName": "India"
        }
    ]
};

const hotelsMock = {
    "status": true,
    "statusCode": 200,
    "totalRecord": 2,
    "body": [
        {
            "propertyId": "HOTEL_001",
            "propertyName": "Taj Deccan",
            "destinationCode": "HYD",
            "destinationName": "Hyderabad",
            "categoryName": "5 Star",
            "price": 9500,
            "currency": "INR",
            "brandCode": "TAJ",
            "address": "Banjara Hills, Hyderabad"
        },
        {
            "propertyId": "HOTEL_002",
            "propertyName": "ITC Kohenur",
            "destinationCode": "HYD",
            "destinationName": "Hyderabad",
            "categoryName": "5 Star",
            "price": 10500,
            "currency": "INR",
            "brandCode": "ITC",
            "address": "HITEC City, Hyderabad"
        }
    ]
};

const productsMock = {
    "status": true,
    "statusCode": 200,
    "body": {
        "propertyId": "HOTEL_001",
        "propertyName": "Taj Deccan",
        "products": [
            {
                "roomCode": "DLX",
                "roomName": "Deluxe Room",
                "rates": [
                    {
                        "rateKey": "RATE_KEY_001",
                        "rateType": "BOOKABLE",
                        "totalPrice": 9500,
                        "currency": "INR",
                        "boardCode": "RO",
                        "boardName": "Room Only",
                        "cancellationPolicies": [
                            {
                                "from": "2025-09-28",
                                "amount": 0
                            },
                            {
                                "from": "2025-09-30",
                                "amount": 9500
                            }
                        ],
                        "status": "Available"
                    }
                ]
            }
        ]
    }
};

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
    async getDestinations() {
        return destinationsMock;
    }

    async getBestProperties(_payload: any) {
        return hotelsMock;
    }

    async getAllProducts(_payload: any) {
        return productsMock;
    }

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
