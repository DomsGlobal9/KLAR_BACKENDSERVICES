// Mock data matching RateGain API v1.5.3 spec response shapes exactly

const destinationsMock = {
    status: true,
    statusCode: 200,
    description: "",
    body: [
        { destCode: "HYD", destName: "Hyderabad India", countryCode: "IN", countryName: "India" },
        { destCode: "BLR", destName: "Bangalore India", countryCode: "IN", countryName: "India" },
        { destCode: "DEL", destName: "Delhi India", countryCode: "IN", countryName: "India" },
        { destCode: "BOM", destName: "Mumbai India", countryCode: "IN", countryName: "India" },
        { destCode: "LAX", destName: "Los Angeles United States", countryCode: "US", countryName: "United States" },
        { destCode: "DXB", destName: "Dubai United Arab Emirates", countryCode: "AE", countryName: "United Arab Emirates" }
    ]
};

const hotelsMock = {
    status: true,
    statusCode: 200,
    description: "",
    totalRecord: 2,
    body: [
        {
            propertyId: "HOTEL_001",
            propertyName: "Taj Deccan",
            description: "A luxury 5-star hotel in the heart of Hyderabad's Banjara Hills.",
            images: [
                "https://example.com/images/taj-deccan-front.jpg",
                "https://example.com/images/taj-deccan-pool.jpg"
            ],
            propertyCode: "2557615",
            countryCode: "IN",
            countryName: "India",
            stateCode: "TG",
            stateName: "Telangana",
            destinationCode: "HYD",
            destinationName: "Hyderabad",
            zoneCode: "Z001",
            zoneName: "Banjara Hills",
            longitude: 78.4071,
            latitude: 17.4126,
            categoryCode: "5S",
            categoryName: "5 Star",
            categoryGroupCode: "LUX",
            categoryGroupDesc: "Luxury Hotels",
            chainCode: "TAJ",
            chainName: "Taj Hotels",
            accomodationType: "Hotel",
            accMultiDesc: "Available in multiple languages",
            accTypeDesc: "Luxury business hotel with premium facilities",
            address: "Banjara Hills, Hyderabad, Telangana 500034",
            street: "Road No. 1",
            city: "Hyderabad",
            postalCode: "500034",
            s2C: "5*",
            ranking: 1,
            brandCode: "TAJ",
            hotelSegments: [
                { code: "SEG1", name: "Luxury" },
                { code: "SEG2", name: "Business" }
            ],
            hotelBoard: [
                { code: "RO", name: "Room Only" },
                { code: "BB", name: "Bed & Breakfast" }
            ],
            hotelFacility: [
                {
                    facilityGroupName: "Wellness",
                    facilityInfo: [
                        { facilityName: "Spa", facilityDescription: "Full-service spa with massage therapy" },
                        { facilityName: "Fitness Center", facilityDescription: "24/7 gym with modern equipment" }
                    ]
                },
                {
                    facilityGroupName: "Recreation",
                    facilityInfo: [
                        { facilityName: "Swimming Pool", facilityDescription: "Outdoor heated pool" }
                    ]
                }
            ],
            hotelAmenities: ["Free WiFi", "Swimming Pool", "Airport Shuttle", "24-hour Room Service"],
            currency: "INR",
            phone: "+91-40-66211234",
            price: 9500.00
        },
        {
            propertyId: "HOTEL_002",
            propertyName: "ITC Kohenur",
            description: "A world-class luxury hotel in HITEC City, Hyderabad.",
            images: [
                "https://example.com/images/itc-kohenur-front.jpg",
                "https://example.com/images/itc-kohenur-pool.jpg"
            ],
            propertyCode: "2557616",
            countryCode: "IN",
            countryName: "India",
            stateCode: "TG",
            stateName: "Telangana",
            destinationCode: "HYD",
            destinationName: "Hyderabad",
            zoneCode: "Z002",
            zoneName: "HITEC City",
            longitude: 78.3827,
            latitude: 17.4435,
            categoryCode: "5S",
            categoryName: "5 Star",
            categoryGroupCode: "LUX",
            categoryGroupDesc: "Luxury Hotels",
            chainCode: "ITC",
            chainName: "ITC Hotels",
            accomodationType: "Hotel",
            accMultiDesc: "Available in multiple languages",
            accTypeDesc: "Luxury tech-hub hotel with premium facilities",
            address: "HITEC City, Hyderabad, Telangana 500081",
            street: "Madhapur",
            city: "Hyderabad",
            postalCode: "500081",
            s2C: "5*",
            ranking: 2,
            brandCode: "ITC",
            hotelSegments: [
                { code: "SEG1", name: "Luxury" },
                { code: "SEG3", name: "Beachfront" }
            ],
            hotelBoard: [
                { code: "RO", name: "Room Only" },
                { code: "BB", name: "Bed & Breakfast" },
                { code: "AI", name: "All Inclusive" }
            ],
            hotelFacility: [
                {
                    facilityGroupName: "Wellness",
                    facilityInfo: [
                        { facilityName: "Spa", facilityDescription: "Award-winning spa" },
                        { facilityName: "Fitness Center", facilityDescription: "State-of-the-art gym" }
                    ]
                }
            ],
            hotelAmenities: ["Free WiFi", "Infinity Pool", "Business Center", "Valet Parking"],
            currency: "INR",
            phone: "+91-40-71002222",
            price: 12000.00
        }
    ]
};

const productsMock = {
    status: true,
    statusCode: 200,
    description: "",
    body: {
        propertyId: "HOTEL_001",
        propertyName: "Taj Deccan",
        description: "A luxury 5-star hotel in the heart of Hyderabad's Banjara Hills.",
        images: [
            "https://example.com/images/taj-deccan-front.jpg",
            "https://example.com/images/taj-deccan-pool.jpg"
        ],
        propertyCode: "2557615",
        brandCode: "TAJ",
        countryCode: "IN",
        countryName: "India",
        stateCode: "TG",
        stateName: "Telangana",
        destinationCode: "HYD",
        categoryCode: "5S",
        categoryName: "5 Star Hotel",
        address: "Banjara Hills, Hyderabad",
        street: "Road No. 1",
        city: "Hyderabad",
        postalCode: "500034",
        phone: "+91-40-66211234",
        hotelSegments: [{ code: "SEG1", name: "Luxury" }],
        hotelBoard: [{ code: "RO", name: "Room Only" }, { code: "BB", name: "Bed & Breakfast" }],
        hotelFacility: [],
        hotelAmenities: ["Free WiFi", "Swimming Pool", "24-hour Room Service"],
        products: [
            {
                roomCode: "DBL.ST",
                name: "STANDARD DOUBLE",
                nativeCurrency: "INR",
                images: [
                    "https://example.com/images/double-room.jpg"
                ],
                rate: [
                    {
                        rateKey: "20260601|20260605|W|71|HOTEL_001|DBL.ST|MOCK-RATE|RO||1~2~0||N@MOCK001",
                        RateCode: "NOR",
                        rateType: "BOOKABLE",
                        rateName: "Standard Rate",
                        isMandatory: false,
                        totalPrice: "9500.00",
                        sellingRate: "10450.00",
                        CommissionAmt: "950.0",
                        CommissionPct: "10.00",
                        allotment: 5,
                        rateCommentsId: null,
                        rateComments: "Check-in from 14:00. Check-out by 12:00. Parking available.",
                        paymentType: "AT_WEB",
                        packaging: false,
                        boardCode: "RO",
                        boardName: "ROOM ONLY",
                        cancellationPolicies: [
                            {
                                amount: "0.00",
                                from: "2026-05-20 00:00:00",
                                toDate: "2026-05-28 23:59:59",
                                amendCharge: null,
                                amendRestricted: false,
                                cancelRestricted: false,
                                noShowPolicy: null
                            },
                            {
                                amount: "9500.00",
                                from: "2026-05-29 00:00:00",
                                toDate: "2026-06-01 23:59:59",
                                amendCharge: null,
                                amendRestricted: true,
                                cancelRestricted: true,
                                noShowPolicy: false
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
            },
            {
                roomCode: "SUI.DLX",
                name: "DELUXE SUITE",
                nativeCurrency: "INR",
                images: [
                    "https://example.com/images/suite.jpg"
                ],
                rate: [
                    {
                        rateKey: "20260601|20260605|W|71|HOTEL_001|SUI.DLX|MOCK-RATE|BB||1~2~0||N@MOCK002",
                        RateCode: "NOR",
                        rateType: "BOOKABLE",
                        rateName: "Breakfast Included Rate",
                        isMandatory: false,
                        totalPrice: "15000.00",
                        sellingRate: "16500.00",
                        CommissionAmt: "1500.0",
                        CommissionPct: "10.00",
                        allotment: 3,
                        rateCommentsId: null,
                        rateComments: "Includes breakfast for 2. Check-in from 15:00.",
                        paymentType: "AT_WEB",
                        packaging: false,
                        boardCode: "BB",
                        boardName: "BED AND BREAKFAST",
                        cancellationPolicies: [
                            {
                                amount: "0.00",
                                from: "2026-05-20 00:00:00",
                                toDate: "2026-05-25 23:59:59",
                                amendCharge: null,
                                amendRestricted: false,
                                cancelRestricted: false,
                                noShowPolicy: null
                            },
                            {
                                amount: "15000.00",
                                from: "2026-05-26 00:00:00",
                                toDate: null,
                                amendCharge: null,
                                amendRestricted: true,
                                cancelRestricted: true,
                                noShowPolicy: false
                            }
                        ],
                        taxes: {
                            allIncluded: false,
                            taxes: [
                                {
                                    included: true,
                                    amount: "1350.00",
                                    currency: "INR",
                                    clientAmount: "1350.00",
                                    clientCurrency: "INR"
                                }
                            ]
                        },
                        Fees: [
                            {
                                Name: "Resort Fee",
                                Description: "Daily resort facilities charge",
                                Included: false,
                                Amount: "500.00",
                                Currency: "INR"
                            }
                        ],
                        rooms: 1,
                        adults: 2,
                        children: 0,
                        childrenAges: "",
                        offers: [],
                        allocationDetails: "MOCK_ALLOC_002",
                        status: "Available"
                    }
                ]
            }
        ]
    }
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

    // Stub methods to satisfy interface (search service doesn't call these)
    async precheck(_payload: any) {
        return { status: false, statusCode: 501, description: "Not implemented in search service" };
    }

    async commit(_payload: any) {
        return { status: false, statusCode: 501, description: "Not implemented in search service" };
    }

    async cancel(_payload: any) {
        return { status: false, statusCode: 501, description: "Not implemented in search service" };
    }

    async getSpecialRequests() {
        // Matches spec: direct array of { code, specialrequest }
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
