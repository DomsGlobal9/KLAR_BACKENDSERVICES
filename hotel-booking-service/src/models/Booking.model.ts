import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Booking status enum
 */
export enum BookingStatus {
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
    PENDING = 'PENDING',
    FAILED = 'FAILED',
    HELD = 'HELD'
}

/**
 * Provider enum - which OTA supplied this booking
 */
export enum BookingProvider {
    RATEGAIN = 'rategain',
    TRIPJACK = 'tripjack',
}

/**
 * Optional: Structured room schema (recommended)
 */
export interface IRoom {
    roomType?: string;
    guests?: number;
    price?: number;
    [key: string]: any;
}

/**
 * Booking interface
 */
export interface IBooking extends Document {
    confirmationNumber: string;
    reservationId: string;
    propertyId: string;
    propertyCode: string;
    provider: BookingProvider;
    status: BookingStatus;
    checkIn: Date;
    checkOut: Date;
    totalAmount: number;
    currencyCode: string;
    guestName?: string;
    agentId?: string;
    agentName?: string;
    userId?: string;
    userName?: string;
    rooms: IRoom[];

    // --- Hotel display fields (shown on My Bookings & Detail pages) ---
    hotelName?: string;
    hotelImage?: string;
    roomType?: string;
    amenities?: string[];
    images?: string[];

    // --- Raw provider payloads ---
    rateGainRequest?: any;
    rateGainResponse?: any;
    tripJackRequest?: any;
    tripJackResponse?: any;

    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Room sub-schema
 */
const roomSchema = new Schema<IRoom>(
    {
        roomType: { type: String },
        guests: { type: Number },
        price: { type: Number }
    },
    { _id: false, strict: false }
);

/**
 * Booking schema
 */
const bookingSchema = new Schema<IBooking>(
    {
        confirmationNumber: {
            type: String,
            required: true,
            index: true,
            unique: true
        },
        reservationId: { type: String, required: true },
        propertyId: { type: String, required: true },
        propertyCode: { type: String, required: true },

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

        totalAmount: { type: Number, required: true },
        currencyCode: { type: String, required: true },

        guestName: { type: String },
        agentId: { type: String, index: true },
        agentName: { type: String },
        userId: { type: String, index: true },
        userName: { type: String },

        // Hotel display fields (both providers)
        hotelName: { type: String },
        hotelImage: { type: String },
        roomType: { type: String },
        amenities: { type: [String], default: [] },
        images: { type: [String], default: [] },

        rooms: {
            type: [roomSchema],
            default: []
        },

        // Raw provider payloads
        rateGainRequest: { type: Schema.Types.Mixed },
        rateGainResponse: { type: Schema.Types.Mixed },
        tripJackRequest: { type: Schema.Types.Mixed },
        tripJackResponse: { type: Schema.Types.Mixed },
    },
    {
        timestamps: true
    }
);

bookingSchema.index({ reservationId: 1 });
bookingSchema.index({ propertyId: 1, checkIn: 1 });

export const BookingModel: Model<IBooking> =
    mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);