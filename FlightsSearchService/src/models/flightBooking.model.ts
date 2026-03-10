import mongoose, { Schema, Document } from 'mongoose';

export enum BookingStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
    ON_HOLD = 'ON_HOLD',
    UNCONFIRMED = 'UNCONFIRMED'
}

export enum PassengerType {
    ADULT = 'ADULT',
    CHILD = 'CHILD',
    INFANT = 'INFANT'
}

export enum Title {
    MR = 'Mr',
    MRS = 'Mrs',
    MS = 'Ms',
    MASTER = 'Master'
}

export interface ISSRItem {
    key: string;
    code: string;
}

export interface IPassenger extends Document {
    ti: Title;
    fN: string;
    lN: string;
    pt: PassengerType;
    dob: Date;
    pNat?: string;
    pNum?: string;
    eD?: Date;
    pid?: Date;
    di?: string;
    ssrBaggageInfos?: ISSRItem[];
    ssrMealInfos?: ISSRItem[];
    ssrSeatInfos?: ISSRItem[];
    ssrExtraServiceInfos?: ISSRItem[];
}

export interface IPaymentInfo {
    amount: number;
}

export interface IGstInfo {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address?: string;
}

export interface IDeliveryInfo {
    emails: string[];
    contacts: string[];
}

export interface IContactInfo {
    emails: string[];
    contacts: string[];
    ecn?: string;
}

export interface IFlightBooking extends Document {
    bookingId: string;
    userId: string;
    paymentInfos: IPaymentInfo[];
    travellerInfo: IPassenger[];
    gstInfo?: IGstInfo;
    deliveryInfo: IDeliveryInfo;
    contactInfo?: IContactInfo;
    status: BookingStatus;
    totalAmount: number;
    bookingDate: Date;
    priceIds?: string[];
    tripDetails?: any;
    failureReason?: string;
    cancelledAt?: Date;
    confirmedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PassengerSchema = new Schema<IPassenger>({
    ti: {
        type: String,
        required: true,
        enum: Object.values(Title)
    },
    fN: { type: String, required: true },
    lN: { type: String, required: true },
    pt: {
        type: String,
        required: true,
        enum: Object.values(PassengerType)
    },
    dob: { type: Date, required: true },
    pNat: { type: String },
    pNum: { type: String },
    eD: { type: Date },
    pid: { type: Date },
    di: { type: String },
    ssrBaggageInfos: [{
        key: { type: String, required: true },
        code: { type: String, required: true }
    }],
    ssrMealInfos: [{
        key: { type: String, required: true },
        code: { type: String, required: true }
    }],
    ssrSeatInfos: [{
        key: { type: String, required: true },
        code: { type: String, required: true }
    }],
    ssrExtraServiceInfos: [{
        key: { type: String, required: true },
        code: { type: String, required: true }
    }]
}, { _id: false });

const FlightBookingSchema = new Schema<IFlightBooking>({
    bookingId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    paymentInfos: [{
        amount: { type: Number, required: true }
    }],
    travellerInfo: [PassengerSchema],
    gstInfo: {
        gstNumber: { type: String },
        registeredName: { type: String },
        email: { type: String },
        mobile: { type: String },
        address: { type: String }
    },
    deliveryInfo: {
        emails: [{ type: String }],
        contacts: [{ type: String }]
    },
    contactInfo: {
        emails: [{ type: String }],
        contacts: [{ type: String }],
        ecn: { type: String }
    },
    status: {
        type: String,
        enum: Object.values(BookingStatus),
        default: BookingStatus.PENDING,
        index: true
    },
    
    bookingDate: { type: Date, default: Date.now },
    priceIds: [{ type: String }],
    tripDetails: { type: Schema.Types.Mixed },
    failureReason: { type: String },
    cancelledAt: { type: Date },
    confirmedAt: { type: Date }
}, {
    timestamps: true
});

FlightBookingSchema.index({ createdAt: -1 });
FlightBookingSchema.index({ status: 1, createdAt: -1 });

export const FlightBookingModel = mongoose.model<IFlightBooking>('FlightBooking', FlightBookingSchema);