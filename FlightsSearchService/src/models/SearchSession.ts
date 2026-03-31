import mongoose, { Schema, Document } from "mongoose";

/**
 * Interface for Route information
 */
export interface IRoute {
    from: string;
    to: string;
    travelDate: Date;
    routeIndex: number;
}

/**
 * Interface for Passenger Information
 */
export interface IPaxInfo {
    adult: number;
    child: number;
    infant: number;
}

/**
 * Interface for Search Modifiers
 */
export interface ISearchModifiers {
    isDirectFlight: boolean;
    isConnectingFlight: boolean;
    pft: "REGULAR" | "STUDENT" | "SENIOR_CITIZEN";
}

/**
 * Interface for Search Session Document
 */
export interface ISearchSession extends Document {
    userId: mongoose.Types.ObjectId | null;
    cabinClass: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
    paxInfo: IPaxInfo;
    searchModifiers: ISearchModifiers;
    preferredAirlines: string[];
    routeInfos: IRoute[];
    createdAt: Date;
    expiresAt: Date;
    isExpired(): boolean;
}

/**
 * Interface for Search Session Model with static methods
 */
export interface ISearchSessionModel extends mongoose.Model<ISearchSession> {
    findActiveByUserId(userId: mongoose.Types.ObjectId): Promise<ISearchSession[]>;
}

/**
 * Route Schema
 */
const RouteSchema = new Schema<IRoute>(
    {
        from: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
        },
        to: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
        },
        travelDate: {
            type: Date,
            required: true,
        },
        routeIndex: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { _id: false }
);

/**
 * Passenger Info Schema
 */
const PaxInfoSchema = new Schema<IPaxInfo>(
    {
        adult: {
            type: Number,
            required: true,
            min: 1,
            max: 9,
            default: 1,
        },
        child: {
            type: Number,
            required: true,
            min: 0,
            max: 8,
            default: 0,
        },
        infant: {
            type: Number,
            required: true,
            min: 0,
            max: 4,
            default: 0,
        },
    },
    { _id: false }
);

/**
 * Search Modifiers Schema
 */
const SearchModifiersSchema = new Schema<ISearchModifiers>(
    {
        isDirectFlight: {
            type: Boolean,
            default: false,
        },
        isConnectingFlight: {
            type: Boolean,
            default: true,
        },
        pft: {
            type: String,
            enum: ["REGULAR", "STUDENT", "SENIOR_CITIZEN"],
            default: "REGULAR",
        },
    },
    { _id: false }
);

/**
 * Search Session Schema
 */
const SearchSessionSchema = new Schema<ISearchSession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        cabinClass: {
            type: String,
            enum: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
            default: "ECONOMY",
            required: true,
        },
        paxInfo: {
            type: PaxInfoSchema,
            required: true,
        },
        searchModifiers: {
            type: SearchModifiersSchema,
            required: true,
        },
        preferredAirlines: {
            type: [String],
            default: [],
        },
        routeInfos: {
            type: [RouteSchema],
            required: true,
            validate: {
                validator: function (routes: IRoute[]) {
                    return routes.length > 0 && routes.length <= 6;
                },
                message: "Routes must have between 1 and 6 segments",
            },
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now

        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
    }
);

/**
 * TTL Index - Automatically deletes expired searches
 * Documents will be deleted when expiresAt time is reached
 */
SearchSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Compound index for efficient queries
 */
SearchSessionSchema.index({ userId: 1, createdAt: -1 });

/**
 * Virtual for trip type
 */
SearchSessionSchema.virtual("tripType").get(function () {
    if (this.routeInfos.length === 1) return "ONE_WAY";
    if (this.routeInfos.length === 2) return "ROUND_TRIP";
    return "MULTI_CITY";
});

/**
 * Method to check if session is expired
 */
SearchSessionSchema.methods.isExpired = function (): boolean {
    return this.expiresAt < new Date();
};

/**
 * Static method to find active sessions for a user
 */
SearchSessionSchema.statics.findActiveByUserId = function (
    userId: mongoose.Types.ObjectId
) {
    return this.find({
        userId,
        expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
};

/**
 * Pre-save hook to validate passenger count
 */
SearchSessionSchema.pre("save", function () {
    const totalPax = this.paxInfo.adult + this.paxInfo.child + this.paxInfo.infant;

    if (totalPax > 9) {
        throw new Error("Total passengers cannot exceed 9");
    }

    if (this.paxInfo.infant > this.paxInfo.adult) {
        throw new Error("Number of infants cannot exceed number of adults");
    }
});

/**
 * Export the model
 */
export const SearchSession = mongoose.model<ISearchSession, ISearchSessionModel>(
    "SearchSession",
    SearchSessionSchema
);
