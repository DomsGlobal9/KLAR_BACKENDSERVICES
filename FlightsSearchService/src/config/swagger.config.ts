import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Flights Review Service API",
            version: "1.0.0",
            description: "API for reviewing and revalidating flight bookings before final confirmation",
            contact: {
                name: "API Support",
                email: "support@example.com"
            }
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server"
            },
            {
                url: "https://api.example.com",
                description: "Production server"
            }
        ],
        components: {
            schemas: {
                ReviewInput: {
                    type: "object",
                    required: ["searchId", "priceIds"],
                    properties: {
                        searchId: {
                            type: "string",
                            description: "Search session ID from the flight search",
                            example: "TJS107700007440"
                        },
                        priceIds: {
                            type: "array",
                            items: {
                                type: "string"
                            },
                            description: "Array of price IDs to review",
                            example: ["TJS107700007440_DELBLRUK807_5962124616134657"]
                        }
                    }
                },
                ReviewResult: {
                    type: "object",
                    properties: {
                        reviewId: {
                            type: "string",
                            description: "Unique booking/review ID",
                            example: "TJS107700007440"
                        },
                        expiresAt: {
                            type: "string",
                            format: "date-time",
                            description: "Expiration timestamp for this review",
                            example: "2024-02-05T12:30:00Z"
                        },
                        price: {
                            $ref: "#/components/schemas/TotalFare"
                        },
                        trips: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/Trip"
                            }
                        },
                        conditions: {
                            $ref: "#/components/schemas/BookingConditions"
                        },
                        ssrAllowed: {
                            $ref: "#/components/schemas/SSRAvailability"
                        },
                        fareChange: {
                            $ref: "#/components/schemas/FareChange"
                        }
                    }
                },
                RevalidateInput: {
                    type: "object",
                    required: ["reviewId"],
                    properties: {
                        reviewId: {
                            type: "string",
                            description: "Review/Booking ID from the review API",
                            example: "TJS107700007440"
                        }
                    }
                },
                RevalidateResult: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            description: "Whether revalidation was successful"
                        },
                        fareValid: {
                            type: "boolean",
                            description: "Whether the fare is still valid"
                        },
                        price: {
                            $ref: "#/components/schemas/TotalFare"
                        },
                        fareChange: {
                            $ref: "#/components/schemas/FareChange"
                        },
                        message: {
                            type: "string",
                            description: "Additional message about the revalidation"
                        }
                    }
                },
                TotalFare: {
                    type: "object",
                    properties: {
                        totalFare: {
                            type: "number",
                            description: "Total fare amount",
                            example: 3617.70
                        },
                        baseFare: {
                            type: "number",
                            description: "Base fare amount",
                            example: 3043.00
                        },
                        taxes: {
                            type: "number",
                            description: "Total taxes",
                            example: 574.70
                        },
                        currency: {
                            type: "string",
                            description: "Currency code",
                            example: "INR"
                        }
                    }
                },
                Trip: {
                    type: "object",
                    properties: {
                        priceId: {
                            type: "string",
                            example: "TJS107700007440_DELBLRUK807_5962124616134657"
                        },
                        fareIdentifier: {
                            type: "string",
                            example: "PUBLISHED"
                        },
                        segments: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/Segment"
                            }
                        }
                    }
                },
                Segment: {
                    type: "object",
                    properties: {
                        segmentId: {
                            type: "string",
                            example: "021"
                        },
                        from: {
                            type: "string",
                            description: "Departure airport code",
                            example: "DEL"
                        },
                        to: {
                            type: "string",
                            description: "Arrival airport code",
                            example: "BLR"
                        },
                        departure: {
                            type: "string",
                            format: "date-time",
                            example: "2020-05-19T20:40"
                        },
                        arrival: {
                            type: "string",
                            format: "date-time",
                            example: "2020-05-19T23:20"
                        },
                        airline: {
                            type: "string",
                            description: "Airline code",
                            example: "UK"
                        },
                        flightNumber: {
                            type: "string",
                            example: "807"
                        },
                        ssr: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/SSRGroup"
                            }
                        }
                    }
                },
                SSRGroup: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            description: "SSR type (MEAL, BAGGAGE, SEAT, etc.)",
                            example: "MEAL"
                        },
                        options: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/SSROption"
                            }
                        }
                    }
                },
                SSROption: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            example: "VGML"
                        },
                        amount: {
                            type: "number",
                            example: 0.00
                        },
                        description: {
                            type: "string",
                            example: "Vegan Veg Meal"
                        }
                    }
                },
                BookingConditions: {
                    type: "object",
                    properties: {
                        dob: {
                            type: "object",
                            properties: {
                                adult: {
                                    type: "boolean",
                                    description: "Is DOB required for adults"
                                },
                                child: {
                                    type: "boolean",
                                    description: "Is DOB required for children"
                                },
                                infant: {
                                    type: "boolean",
                                    description: "Is DOB required for infants"
                                }
                            }
                        },
                        gst: {
                            type: "object",
                            properties: {
                                mandatory: {
                                    type: "boolean",
                                    description: "Is GST mandatory"
                                },
                                applicable: {
                                    type: "boolean",
                                    description: "Is GST applicable"
                                }
                            }
                        },
                        emergencyContactRequired: {
                            type: "boolean"
                        },
                        holdAllowed: {
                            type: "boolean",
                            description: "Is hold booking allowed"
                        }
                    }
                },
                SSRAvailability: {
                    type: "object",
                    properties: {
                        seat: {
                            type: "boolean",
                            description: "Are seat selections available"
                        },
                        meal: {
                            type: "boolean",
                            description: "Are meal options available"
                        },
                        baggage: {
                            type: "boolean",
                            description: "Is extra baggage available"
                        },
                        hold: {
                            type: "boolean",
                            description: "Is hold booking available"
                        },
                        frequentFlier: {
                            type: "boolean",
                            description: "Can frequent flier info be added"
                        }
                    }
                },
                FareChange: {
                    type: "object",
                    properties: {
                        oldFare: {
                            type: "number",
                            example: 3617.70
                        },
                        newFare: {
                            type: "number",
                            example: 3800.00
                        },
                        difference: {
                            type: "number",
                            example: 182.30
                        },
                        percentageChange: {
                            type: "number",
                            example: 5.04
                        }
                    }
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: false
                        },
                        message: {
                            type: "string",
                            example: "Error message"
                        },
                        error: {
                            type: "string",
                            example: "Detailed error information"
                        }
                    }
                }
            }
        }
    },
    apis: ["./src/routes/*.ts", "./src/controllers/*.ts"]
};

export const swaggerSpec = swaggerJsdoc(options);
