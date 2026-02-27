import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Booking status enum
 */
export enum BookingStatus {
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
    PENDING = 'PENDING',
    FAILED = 'FAILED'
}

/**
 * Optional: Structured room schema (recommended)
 * Comment this out if you want fully dynamic rooms.
 */
export interface IRoom {
    roomType?: string;
    guests?: number;
    price?: number;
    [key: string]: any; // allows extra RateGain fields
}

/**
 * Booking interface
 */
export interface IBooking extends Document {
    confirmationNumber: string;
    reservationId: string;
    propertyId: string;
    propertyCode: string;
    status: BookingStatus;
    checkIn: Date;
    checkOut: Date;
    totalAmount: number;
    currencyCode: string;
    guestName?: string;
    rooms: IRoom[]; // typed rooms
    rateGainRequest?: any;
    rateGainResponse?: any;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Room sub-schema (recommended for validation)
 */
const roomSchema = new Schema<IRoom>(
    {
        roomType: { type: String },
        guests: { type: Number },
        price: { type: Number }
    },
    { _id: false, strict: false } // allow extra fields from RateGain
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

        /**
         * ✅ FIXED: rooms array (Mongoose v8 compatible)
         */
        rooms: {
            type: [roomSchema], // strongly typed array
            default: []
        },

        /**
         * Store raw RateGain payloads
         */
        rateGainRequest: { type: Schema.Types.Mixed },
        rateGainResponse: { type: Schema.Types.Mixed }
    },
    {
        timestamps: true
    }
);

/**
 * Useful indexes for OTA workloads
 */
bookingSchema.index({ reservationId: 1 });
bookingSchema.index({ propertyId: 1, checkIn: 1 });

/**
 * Model export
 */
export const BookingModel: Model<IBooking> =
    mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);