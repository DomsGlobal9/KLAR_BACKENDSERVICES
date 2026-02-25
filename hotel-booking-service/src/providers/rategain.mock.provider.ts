// Mock data matching RateGain API v1.5.3 spec response shapes exactly

const precheckMock = {
    status: true,
    description: null,
    statusCode: 200,
    body: {
        preCheckResponse: {
            checkin: "2026-06-01",
            checkout: "2026-06-05",
            propertyCode: "2557615",
            hotelName: "Taj Deccan",
            categoryCode: "5EST",
            categoryName: "5 STARS",
            destinationCode: "HYD",
            destinationName: "Hyderabad",
            zoneCode: 10,
            zoneName: "Banjara Hills",
            latitude: "17.4126",
            longitude: "78.4071",
            rooms: [
                {
                    RoomCode: "DBL.ST",
                    name: "STANDARD DOUBLE",
                    status: null,
                    paxes: null,
                    rates: [
                        {
                            rateKey: "20260601|20260605|W|71|HOTEL_001|DBL.ST|MOCK-RATE|RO||1~2~0||N@MOCK",
                            RateCode: "NOR",
                            rateType: "BOOKABLE",
                            totalPrice: "9500.00",
                            isMandatory: false,
                            sellingRate: "10450.00",
                            CommissionAmt: "950.0",
                            CommissionPct: "10.00",
                            allotment: 5,
                            rateName: "Standard Rate",
                            rateCommentsId: null,
                            rateComments: "Check-in from 14:00. Check-out by 12:00.",
                            paymentType: "AT_WEB",
                            packaging: false,
                            boardCode: "RO",
                            boardName: "ROOM ONLY",
                            cancellationPolicies: [
                                {
                                    amount: "0.00",
                                    from: "2026-05-20T00:00:00+05:30",
                                    toDate: "2026-05-28T23:59:59+05:30",
                                    amendCharge: null,
                                    amendRestricted: false,
                                    cancelRestricted: false,
                                    noShowPolicy: null
                                },
                                {
                                    amount: "9500.00",
                                    from: "2026-05-29T00:00:00+05:30",
                                    toDate: null,
                                    amendCharge: null,
                                    amendRestricted: true,
                                    cancelRestricted: true,
                                    noShowPolicy: null
                                }
                            ],
                            taxes: {
                                allIncluded: false,
                                taxes: [
                                    {
                                        included: true,
                                        amount: "850.00",
                                        currency: "INR",
                                        clientAmount: "850.00",
                                        clientCurrency: "INR"
                                    }
                                ]
                            },
                            Fees: [],
                            rooms: 1,
                            adults: 2,
                            children: 0,
                            childrenAges: "",
                            offers: [],
                            allocationDetails: "MOCK_ALLOC_001",
                            status: "Available"
                        }
                    ]
                }
            ],
            minRate: null,
            maxRate: null,
            currency: "INR",
            totalNet: "9500.00",
            sellingRate: "10450.00",
            CommissionAmt: "950.0",
            CommissionPct: "10.00",
            paymentDataRequired: false,
            modificationPolicies: {
                cancellation: true,
                modification: true
            }
        },
        booking: null
    }
};

const commitMock = {
    status: true,
    description: null,
    statusCode: 200,
    body: {
        preCheakResponse: null,
        booking: {
            confirmationNumber: "MOCK#CONF123456",
            echotoken: "MOCK-ECHO-001",
            creationDate: new Date().toISOString().split("T")[0],
            status: "Confirmed",
            modificationPolicies: {
                cancellation: true,
                modification: false
            },
            holder: {
                name: "John",
                surname: "Doe",
                email: null,
                phone: null
            },
            hotel: {
                checkIn: "2026-06-01",
                checkout: "2026-06-05",
                code: 2557615,
                brandCode: "TAJ",
                hotelName: "Taj Deccan",
                categoryCode: "5EST",
                categoryName: "5 STARS",
                destinationCode: "HYD",
                destinationName: "Hyderabad",
                countryCode: "IN",
                countryName: "India",
                stateCode: "TG",
                stateName: "Telangana",
                address: "Banjara Hills, Hyderabad",
                street: "Road No. 1",
                city: "Hyderabad",
                postalCode: "500034",
                phone: "+91-40-66211234",
                zoneCode: 10,
                zoneName: "Banjara Hills",
                latitude: "17.4126",
                longitude: "78.4071",
                rooms: [
                    {
                        RoomCode: "DBL.ST",
                        name: "STANDARD DOUBLE",
                        status: "CONFIRMED",
                        paxes: [
                            { roomId: 1, type: "AD", name: "John", surname: "Doe", age: 0 },
                            { roomId: 1, type: "AD", name: null, surname: null, age: 0 }
                        ],
                        rates: [
                            {
                                rateKey: null,
                                RateCode: "NOR",
                                rateType: null,
                                rateName: "Standard Rate",
                                allotment: 0,
                                rateCommentsId: null,
                                rateComments: "Check-in from 14:00. Check-out by 12:00.",
                                paymentType: "AT_WEB",
                                packaging: false,
                                boardCode: "RO",
                                boardName: "ROOM ONLY",
                                cancellationPolicies: [
                                    { amount: "9500.00", from: "2026-05-29T00:00:00+05:30" }
                                ],
                                taxes: [
                                    { included: true, amount: "850.00", currency: "INR", clientAmount: "850.00", clientCurrency: "INR" }
                                ],
                                Fees: [],
                                rooms: 1,
                                adults: 2,
                                children: 0,
                                offers: []
                            }
                        ]
                    }
                ],
                paymentDataRequired: false,
                accomodationType: "Hotel"
            },
            remark: null,
            totalNet: 9500.00,
            sellingRate: "10450.00",
            CommissionAmt: "950.0",
            CommissionPct: "10.00",
            voucherRemark: "Payable through Klar Travel. Reference: MOCK123456",
            currency: "INR",
            reservationId: "mock-res-" + Date.now()
        }
    }
};

const cancelMock = {
    status: true,
    description: null,
    statusCode: 200,
    body: {
        cancellationNumber: "MOCK-CANCEL-" + Math.floor(Math.random() * 999999),
        confirmationNumber: "MOCK#CONF123456",
        hotelComments: null,
        checkin: "2026-06-01",
        checkout: "2026-06-05",
        propertyCode: "2557615",
        token: null,
        guest: {
            firstName: "John",
            lastName: "Doe",
            primary: false,
            email: null,
            phone: null
        },
        status: "CANCELLED",
        hotelName: "Taj Deccan",
        roomType: "STANDARD DOUBLE",
        totalAmount: "9500.00",
        currency: "INR",
        numberOfRooms: 1,
        numberOfAdults: 2,
        numberOfChildren: 0
    }
};

export class RateGainMockProvider {
    async precheck(_payload: any) {
        return precheckMock;
    }

    async commit(_payload: any) {
        return commitMock;
    }

    async cancel(_payload: any) {
        return cancelMock;
    }

    async getSpecialRequests() {
        // Matches spec: array of { code, specialrequest }
        return [
            { code: 98085, specialrequest: "Peanut allergy" },
            { code: 92295, specialrequest: "Guest has a sensory impairment (hearing or vision loss)" },
            { code: 92305, specialrequest: "Request a wheelchair-accessible room with a separate shower" },
            { code: 10001, specialrequest: "Late Check-out" },
            { code: 10002, specialrequest: "Early Check-in" },
            { code: 10003, specialrequest: "Non-smoking Room" },
            { code: 10004, specialrequest: "High floor room" },
            { code: 10005, specialrequest: "Quiet room" }
        ];
    }
}
