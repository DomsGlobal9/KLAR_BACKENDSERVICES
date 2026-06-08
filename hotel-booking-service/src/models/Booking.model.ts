import mongoose, { Schema, Document, Model } from 'mongoose';

export enum BookingStatus {
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
    PENDING = 'PENDING',
    FAILED = 'FAILED',
    HELD = 'HELD'
}

export enum BookingProvider {
    RATEGAIN = 'rategain',
    TRIPJACK = 'tripjack',
}

export interface IRoom {
    roomType?: string;
    boardType?: string;
    guests?: number;
    price?: number;
}

export interface ICancellationPolicy {
    isRefundable: boolean;
    deadline?: string;      // ISO date string
    penalty?: number;       // Amount to be charged
}

export interface IBooking extends Document {
    // ─── Identifiers ───────────────────────────────
    confirmationNumber: string;   // Provider's booking ID (TG-XXXXX)
    reservationId: string;
    propertyId: string;
    provider: BookingProvider;
    status: BookingStatus;

    // ─── Stay Details ──────────────────────────────
    checkIn: Date;
    checkOut: Date;
    rooms: IRoom[];

    // ─── Pricing (stored in INR) ───────────────────
    totalAmount: number;          // What agent paid (net + markup)
    netAmount: number;            // What we paid TripJack/RG
    markupAmount: number;         // Klar's earnings
    currencyCode: string;

    // ─── Hotel Display Fields ──────────────────────
    hotelName?: string;
    hotelImage?: string;
    hotelAddress?: string;
    city?: string;
    starRating?: number;
    roomType?: string;

    // ─── Guest & Agent ─────────────────────────────
    guestName?: string;
    guestEmail?: string;
    guestMobile?: string;
    agentId?: string;
    agentName?: string;
    userId?: string;

    // ─── Cancellation ──────────────────────────────
    cancellationPolicy?: ICancellationPolicy;
    cancelCharge?: number;
    cancellationDetails?: any;

    // ─── Provider Request/Response cache ───────────
    tripJackRequest?: any;
    tripJackResponse?: any;
    rateGainRequest?: any;
    rateGainResponse?: any;
    propertyCode?: string;

    // ─── Provider Error (for failed bookings only) ─
    failureReason?: string;

    createdAt?: Date;
    updatedAt?: Date;
}

const roomSchema = new Schema<IRoom>(
    {
        roomType: { type: String },
        boardType: { type: String },
        guests: { type: Number },
        price: { type: Number }
    },
    { _id: false }
);

const cancellationPolicySchema = new Schema<ICancellationPolicy>(
    {
        isRefundable: { type: Boolean, default: false },
        deadline: { type: String },
        penalty: { type: Number },
    },
    { _id: false }
);

const bookingSchema = new Schema<IBooking>(
    {
        confirmationNumber: { type: String, required: true, index: true, unique: true },
        reservationId: { type: String, required: true },
        propertyId: { type: String, required: true },

        provider: {
            type: String,
            enum: Object.values(BookingProvider),
            default: BookingProvider.RATEGAIN,
            index: true,
        },

        status: {
            type: String,
            enum: Object.values(BookingStatus),
            default: BookingStatus.PENDING,
            index: true
        },

        checkIn: { type: Date, required: true },
        checkOut: { type: Date, required: true },
        rooms: { type: [roomSchema], default: [] },

        // Pricing
        totalAmount: { type: Number, required: true },
        netAmount: { type: Number, required: true },
        markupAmount: { type: Number, default: 0 },
        currencyCode: { type: String, required: true, default: 'INR' },

        // Hotel display
        hotelName: { type: String },
        hotelImage: { type: String },
        hotelAddress: { type: String },
        city: { type: String },
        starRating: { type: Number },
        roomType: { type: String },

        // Guest & Agent
        guestName: { type: String },
        guestEmail: { type: String },
        guestMobile: { type: String },
        agentId: { type: String, index: true },
        agentName: { type: String },
        userId: { type: String, index: true },

        // Cancellation
        cancellationPolicy: { type: cancellationPolicySchema },
        cancelCharge: { type: Number },
        cancellationDetails: { type: Schema.Types.Mixed },

        // Provider logs/cache
        tripJackRequest: { type: Schema.Types.Mixed },
        tripJackResponse: { type: Schema.Types.Mixed },
        rateGainRequest: { type: Schema.Types.Mixed },
        rateGainResponse: { type: Schema.Types.Mixed },
        propertyCode: { type: String },

        // Only for debugging failed bookings
        failureReason: { type: String },
    },
    {
        timestamps: true
    }
);

bookingSchema.index({ agentId: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ propertyId: 1, checkIn: 1 });

export const BookingModel: Model<IBooking> =
    mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);