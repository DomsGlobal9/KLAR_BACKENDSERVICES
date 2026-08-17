import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum InsuranceBookingStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    CANCELLED = "CANCELLED",
    FAILED = "FAILED",
}

/** Lifecycle of the booking-confirmation email for one booking. */
export enum InsuranceNotificationStatus {
    /** Claimed by a sweep and currently being delivered. */
    SENDING = "SENDING",
    /** Accepted by email-service. Terminal — never retried. */
    SENT = "SENT",
    /** Delivery attempt failed. Retried until MAX_ATTEMPTS. */
    FAILED = "FAILED",
    /** No usable recipient. Terminal — retrying cannot help. */
    SKIPPED_NO_RECIPIENT = "SKIPPED_NO_RECIPIENT",
}

export enum InsuranceJourneyType {
    STANDALONE = "STANDALONE",
    STUDENT = "STUDENT",
    AMT = "AMT",
    EMBEDDED = "EMBEDDED",
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface INominee {
    nn: string;  // nominee name
    nr: string;  // nominee relation
}

export interface IStudentCourse {
    cn?: string;   // course name
    cdm?: number;  // course duration months
    un?: string;   // university name
    uc?: string;   // university city
    sn?: string;   // sponsor name
    sdob?: string; // sponsor dob
    sr?: string;   // sponsor relation
    se?: string;   // sponsor email
}

export interface ITraveller {
    id?: number;
    dob?: string;
    age?: number;
    fn?: string;
    ln?: string;
    eid?: string;
    pnum?: string;
    cnum?: string;
    gen?: string;
    ti?: string;
    pincode?: string;
    ni?: INominee[];
    policyId?: string;
    sc?: IStudentCourse; // student only
}

export interface IInsuranceBooking extends Document {
    // TripJack identifiers
    bookingId: string;          // TJS-xxx returned from Book API
    source: string;
    amendmentId?: string;       // returned from Raise Amendment API

    // Journey metadata
    journeyType: InsuranceJourneyType;
    planId?: string;            // plid from search
    productId?: string;         // pid from search
    searchId?: string;          // searchId from search response

    // Coverage
    coverageStart?: Date;
    coverageEnd?: Date;
    coverageDays?: number;      // cd for Student, adr for AMT
    region?: string;            // rkey used

    // Travellers (stored as raw array for flexibility)
    travellers?: ITraveller[];

    // Financials
    amount: number;
    currencyCode: string;

    // Status
    status: InsuranceBookingStatus;
    cancelledAt?: Date;

    /**
     * Confirmation-email state, so the same booking is never confirmed twice.
     *
     * Held on the booking document rather than in memory: the reconciliation
     * sweep runs on every instance and restarts with the process, so an
     * in-memory guard would send one email per instance and again after every
     * deploy. `status` is claimed with an atomic conditional update, which is
     * what actually makes concurrent sweeps safe.
     */
    confirmationEmail?: {
        status?: InsuranceNotificationStatus;
        sentAt?: Date;
        attempts?: number;
        recipientCount?: number;
        lastError?: string;
    };

    /**
     * Customer email the policy was delivered to (deliveryInfo.emails[0]),
     * stored normalised and indexed so booking history can be looked up by
     * email. `agentName` is not usable for this — for a B2C guest it holds the
     * label "B2C Guest" rather than an address.
     */
    contactEmail?: string;

    // Agent / User
    agentId?: string;
    agentName?: string;
    userId?: string;
    userName?: string;

    // Raw TripJack payloads (for debugging / audit)
    tjSearchPayload?: any;
    tjReviewPayload?: any;
    tjBookPayload?: any;
    tjBookResponse?: any;
    tjBookingDetailsResponse?: any;

    createdAt?: Date;
    updatedAt?: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const nomineeSchema = new Schema<INominee>(
    { nn: String, nr: String },
    { _id: false }
);

const studentCourseSchema = new Schema<IStudentCourse>(
    { cn: String, cdm: Number, un: String, uc: String, sn: String, sdob: String, sr: String, se: String },
    { _id: false }
);

const travellerSchema = new Schema<ITraveller>(
    {
        id:      { type: Number },
        dob:     { type: String },
        age:     { type: Number },
        fn:      { type: String },
        ln:      { type: String },
        eid:     { type: String },
        pnum:    { type: String },
        cnum:    { type: String },
        gen:     { type: String },
        ti:      { type: String },
        pincode: { type: String },
        policyId:{ type: String },
        ni:      { type: [nomineeSchema], default: [] },
        sc:      { type: studentCourseSchema },
    },
    { _id: false }
);

// ─── Main Schema ─────────────────────────────────────────────────────────────

const insuranceBookingSchema = new Schema<IInsuranceBooking>(
    {
        // `unique` already builds the index — declaring both warns in Mongoose 8.
        bookingId: { type: String, required: true, unique: true },
        source: { type: String},
        amendmentId: { type: String },

        journeyType: {
            type: String,
            enum: Object.values(InsuranceJourneyType),
            default: InsuranceJourneyType.STANDALONE,
            index: true,
        },
        planId:    { type: String },
        productId: { type: String },
        searchId:  { type: String },

        coverageStart: { type: Date },
        coverageEnd:   { type: Date },
        coverageDays:  { type: Number },
        region:        { type: String },

        travellers: { type: [travellerSchema], default: [] },

        amount:       { type: Number, required: true },
        currencyCode: { type: String, default: "INR" },

        status: {
            type: String,
            enum: Object.values(InsuranceBookingStatus),
            default: InsuranceBookingStatus.PENDING,
            index: true,
        },
        cancelledAt: { type: Date },

        confirmationEmail: {
            status: { type: String, enum: Object.values(InsuranceNotificationStatus) },
            sentAt: { type: Date },
            attempts: { type: Number, default: 0 },
            recipientCount: { type: Number },
            lastError: { type: String },
        },

        contactEmail: { type: String, lowercase: true, trim: true, index: true },

        agentId:   { type: String, index: true },
        agentName: { type: String },
        userId:    { type: String, index: true },
        userName:  { type: String },

        // Raw payloads
        tjSearchPayload:          { type: Schema.Types.Mixed },
        tjReviewPayload:          { type: Schema.Types.Mixed },
        tjBookPayload:            { type: Schema.Types.Mixed },
        tjBookResponse:           { type: Schema.Types.Mixed },
        tjBookingDetailsResponse: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export const InsuranceBookingModel: Model<IInsuranceBooking> =
    mongoose.models.InsuranceBooking ||
    mongoose.model<IInsuranceBooking>("InsuranceBooking", insuranceBookingSchema);
