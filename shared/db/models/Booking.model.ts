import mongoose, { Schema, Document, Model } from 'mongoose';

export enum BookingStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED'
}

export interface IBookingGuest {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    isPrimary: boolean;
}

export interface IBookingRoom {
    roomTypeCode: string;
    numberOfRooms: number;
    numberOfAdults: number;
    numberOfChildren: number;
    roomRate: number;
    boardName: string;
}

export interface IBooking extends Document {
    userId: mongoose.Types.ObjectId;
    confirmationNumber: string;
    propertyId: string;
    propertyName: string;
    propertyCode?: string;
    status: BookingStatus;
    checkIn: Date;
    checkOut: Date;
    totalAmount: number;
    currencyCode: string;
    guests: IBookingGuest[];
    rooms: IBookingRoom[];
    rateGainResponse: any;
    cancelledAt?: Date;
    walletId?: mongoose.Types.ObjectId;
    paymentId?: string;
    paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    createdAt: Date;
    updatedAt: Date;
}

const bookingGuestSchema = new Schema<IBookingGuest>(
    {
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            required: true
        },
        isPrimary: {
            type: Boolean,
            default: false
        }
    },
    { _id: false }
);

const bookingRoomSchema = new Schema<IBookingRoom>(
    {
        roomTypeCode: {
            type: String,
            required: true
        },
        numberOfRooms: {
            type: Number,
            required: true,
            min: 1
        },
        numberOfAdults: {
            type: Number,
            required: true,
            min: 1
        },
        numberOfChildren: {
            type: Number,
            default: 0,
            min: 0
        },
        roomRate: {
            type: Number,
            required: true
        },
        boardName: {
            type: String,
            required: true
        }
    },
    { _id: false }
);

const bookingSchema = new Schema<IBooking>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            index: true
        },
        confirmationNumber: {
            type: String,
            required: [true, 'Confirmation number is required'],
            unique: true
        },
        propertyId: {
            type: String,
            required: [true, 'Property ID is required']
        },
        propertyName: {
            type: String,
            required: [true, 'Property name is required']
        },
        propertyCode: {
            type: String
        },
        status: {
            type: String,
            enum: Object.values(BookingStatus),
            default: BookingStatus.CONFIRMED
        },
        checkIn: {
            type: Date,
            required: [true, 'Check-in date is required']
        },
        checkOut: {
            type: Date,
            required: [true, 'Check-out date is required']
        },
        totalAmount: {
            type: Number,
            required: [true, 'Total amount is required']
        },
        currencyCode: {
            type: String,
            required: [true, 'Currency code is required'],
            default: 'USD'
        },
        guests: {
            type: [bookingGuestSchema],
            required: true,
            validate: {
                validator: (v: IBookingGuest[]) => v.length > 0,
                message: 'At least one guest is required'
            }
        },
        rooms: {
            type: [bookingRoomSchema],
            required: true,
            validate: {
                validator: (v: IBookingRoom[]) => v.length > 0,
                message: 'At least one room is required'
            }
        },
        rateGainResponse: {
            type: Schema.Types.Mixed,
            default: {}
        },
        cancelledAt: {
            type: Date
        },
        walletId: {
            type: Schema.Types.ObjectId,
            required: false // Optional for now
        },
        paymentId: {
            type: String,
            required: false
        },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
            default: 'PENDING'
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret: any) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

// Indexes for performance
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

const Booking: Model<IBooking> = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;
