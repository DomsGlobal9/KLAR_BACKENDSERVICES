import mongoose, { Schema, Document, Model } from 'mongoose';

export enum CabBookingStatus {
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
    PENDING = 'PENDING',
    FAILED = 'FAILED',
}

export interface ICabBooking extends Document {
    bookingId: string;
    correlationId?: string;
    userId?: string;
    status: CabBookingStatus;
    
    // Journey Details
    pickupDate: Date;
    origin: {
        displayAddress: string;
        lat: string;
        long: string;
    };
    destination: {
        displayAddress: string;
        lat: string;
        long: string;
    };
    
    // Vehicle & Pricing
    vehicleType: string;
    vehicleCategory: string;
    totalAmount: number;
    currency: string;
    
    // Passenger Details
    passenger: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
    
    // Raw Payloads
    tripJackRequest?: any;
    tripJackResponse?: any;
    
    createdAt: Date;
    updatedAt: Date;
}

const CabBookingSchema = new Schema<ICabBooking>(
    {
        bookingId: { type: String, required: true, unique: true, index: true },
        correlationId: { type: String, index: true },
        userId: { type: String, index: true },
        status: {
            type: String,
            enum: Object.values(CabBookingStatus),
            default: CabBookingStatus.PENDING,
            index: true
        },
        pickupDate: { type: Date, required: true },
        origin: {
            displayAddress: { type: String, required: true },
            lat: { type: String },
            long: { type: String }
        },
        destination: {
            displayAddress: { type: String, required: true },
            lat: { type: String },
            long: { type: String }
        },
        vehicleType: { type: String, required: true },
        vehicleCategory: { type: String },
        totalAmount: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        passenger: {
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
            email: { type: String, required: true },
            phone: { type: String, required: true }
        },
        tripJackRequest: { type: Schema.Types.Mixed },
        tripJackResponse: { type: Schema.Types.Mixed }
    },
    {
        timestamps: true
    }
);

export const CabBookingModel: Model<ICabBooking> =
    mongoose.models.CabBooking || mongoose.model<ICabBooking>('CabBooking', CabBookingSchema);
