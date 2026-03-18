import mongoose, { Schema, Document } from "mongoose";

/**
 * Interface for Airport Information
 */
export interface IAirport {
    code: string;
    name: string;
    city: string;
    country: string;
    terminal?: string;
}

/**
 * Interface for Airline Information
 */
export interface IAirline {
    code: string;
    name: string;
    flightNumber: string;
}

/**
 * Interface for Segment (Flight Leg)
 */
export interface ISegment {
    segmentIndex: number;
    origin: IAirport;
    destination: IAirport;
    airline: IAirline;
    departureTime: Date;
    arrivalTime: Date;
    duration: number; // in minutes
    stops: number;
    cabin: string;
    aircraft: string;
    baggage: {
        checkIn: string;
        cabin: string;
    };
}

/**
 * Interface for Fare Breakdown
 */
export interface IFareBreakdown {
    baseFare: number;
    taxes: number;
    fees: number;
    total: number;
    currency: string;
}

/**
 * Interface for Fare Details per Passenger Type
 */
export interface IFareDetails {
    adult: IFareBreakdown;
    child?: IFareBreakdown;
    infant?: IFareBreakdown;
}

/**
 * Interface for Flight Document
 */
export interface IFlight extends Document {
    searchSessionId: mongoose.Types.ObjectId;
    supplierId: string; // TripJack, Amadeus, etc.
    supplierReference: string; // Unique reference from supplier

    // Flight Details
    segments: ISegment[];
    totalDuration: number; // in minutes
    stops: number;

    // Pricing
    fareDetails: IFareDetails;
    totalPrice: number;
    currency: string;

    // Booking Details
    cabinClass: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
    availableSeats: number;
    refundable: boolean;

    // Additional Info
    fareRules?: string;
    baggage: {
        checkIn: string;
        cabin: string;
    };

    // Metadata
    isActive: boolean;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Airport Schema
 */
const AirportSchema = new Schema<IAirport>(
    {
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        country: {
            type: String,
            required: true,
            trim: true,
        },
        terminal: {
            type: String,
            trim: true,
        },
    },
    { _id: false }
);

/**
 * Airline Schema
 */
const AirlineSchema = new Schema<IAirline>(
    {
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        flightNumber: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false }
);

/**
 * Baggage Schema
 */
const BaggageSchema = new Schema(
    {
        checkIn: {
            type: String,
            required: true,
            default: "15 KG",
        },
        cabin: {
            type: String,
            required: true,
            default: "7 KG",
        },
    },
    { _id: false }
);

/**
 * Segment Schema
 */
const SegmentSchema = new Schema<ISegment>(
    {
        segmentIndex: {
            type: Number,
            required: true,
            min: 0,
        },
        origin: {
            type: AirportSchema,
            required: true,
        },
        destination: {
            type: AirportSchema,
            required: true,
        },
        airline: {
            type: AirlineSchema,
            required: true,
        },
        departureTime: {
            type: Date,
            required: true,
        },
        arrivalTime: {
            type: Date,
            required: true,
        },
        duration: {
            type: Number,
            required: true,
            min: 0,
        },
        stops: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        cabin: {
            type: String,
            required: true,
        },
        aircraft: {
            type: String,
            required: true,
        },
        baggage: {
            type: BaggageSchema,
            required: true,
        },
    },
    { _id: false }
);

/**
 * Fare Breakdown Schema
 */
const FareBreakdownSchema = new Schema<IFareBreakdown>(
    {
        baseFare: {
            type: Number,
            required: true,
            min: 0,
        },
        taxes: {
            type: Number,
            required: true,
            min: 0,
        },
        fees: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            uppercase: true,
            default: "INR",
        },
    },
    { _id: false }
);

/**
 * Fare Details Schema
 */
const FareDetailsSchema = new Schema<IFareDetails>(
    {
        adult: {
            type: FareBreakdownSchema,
            required: true,
        },
        child: {
            type: FareBreakdownSchema,
        },
        infant: {
            type: FareBreakdownSchema,
        },
    },
    { _id: false }
);

/**
 * Flight Schema
 */
const FlightSchema = new Schema<IFlight>(
    {
        searchSessionId: {
            type: Schema.Types.ObjectId,
            ref: "SearchSession",
            required: true,
            index: true,
        },
        supplierId: {
            type: String,
            required: true,
            trim: true,
            default: "TRIPJACK",
        },
        supplierReference: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        segments: {
            type: [SegmentSchema],
            required: true,
            validate: {
                validator: function (segments: ISegment[]) {
                    return segments.length > 0;
                },
                message: "Flight must have at least one segment",
            },
        },
        totalDuration: {
            type: Number,
            required: true,
            min: 0,
        },
        stops: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        fareDetails: {
            type: FareDetailsSchema,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            uppercase: true,
            default: "INR",
        },
        cabinClass: {
            type: String,
            enum: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
            required: true,
            default: "ECONOMY",
        },
        availableSeats: {
            type: Number,
            required: true,
            min: 0,
            default: 9,
        },
        refundable: {
            type: Boolean,
            required: true,
            default: false,
        },
        fareRules: {
            type: String,
        },
        baggage: {
            type: BaggageSchema,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

/**
 * TTL Index - Automatically deletes expired flights
 */
FlightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Compound indexes for efficient queries
 */
FlightSchema.index({ searchSessionId: 1, isActive: 1, expiresAt: 1 });
FlightSchema.index({ supplierId: 1, supplierReference: 1 });
FlightSchema.index({ totalPrice: 1, stops: 1 }); // For sorting by price and stops

/**
 * Virtual for direct flight
 */
FlightSchema.virtual("isDirect").get(function () {
    return this.stops === 0;
});

/**
 * Virtual for origin and destination
 */
FlightSchema.virtual("origin").get(function () {
    return this.segments[0]?.origin;
});

FlightSchema.virtual("destination").get(function () {
    return this.segments[this.segments.length - 1]?.destination;
});

/**
 * Method to check if flight is expired
 */
FlightSchema.methods.isExpired = function (): boolean {
    return this.expiresAt < new Date();
};

/**
 * Method to calculate layover time
 */
FlightSchema.methods.getLayoverTime = function (segmentIndex: number): number | null {
    if (segmentIndex >= this.segments.length - 1) return null;

    const currentSegment = this.segments[segmentIndex];
    const nextSegment = this.segments[segmentIndex + 1];

    const layoverMs = nextSegment.departureTime.getTime() - currentSegment.arrivalTime.getTime();
    return Math.floor(layoverMs / (1000 * 60)); // Convert to minutes
};

/**
 * Static method to find flights by search session
 */
FlightSchema.statics.findBySearchSession = function (
    searchSessionId: mongoose.Types.ObjectId,
    options: {
        maxPrice?: number;
        directOnly?: boolean;
        airlines?: string[];
    } = {}
) {
    const query: any = {
        searchSessionId,
        isActive: true,
        expiresAt: { $gt: new Date() },
    };

    if (options.maxPrice) {
        query.totalPrice = { $lte: options.maxPrice };
    }

    if (options.directOnly) {
        query.stops = 0;
    }

    if (options.airlines && options.airlines.length > 0) {
        query["segments.airline.code"] = { $in: options.airlines };
    }

    return this.find(query).sort({ totalPrice: 1 });
};

/**
 * Pre-save hook to calculate total duration
 */
FlightSchema.pre("save", function () {
    if (this.segments && this.segments.length > 0) {
        const firstSegment = this.segments[0];
        const lastSegment = this.segments[this.segments.length - 1];

        const totalMs = lastSegment.arrivalTime.getTime() - firstSegment.departureTime.getTime();
        this.totalDuration = Math.floor(totalMs / (1000 * 60)); // Convert to minutes
    }
});

/**
 * Export the model
 */
export const Flight = mongoose.model<IFlight>("Flight", FlightSchema);
