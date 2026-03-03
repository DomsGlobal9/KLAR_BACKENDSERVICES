import mongoose, { Schema, Document } from 'mongoose';
import { ContactInfo, DeliveryInfo, GSTInfo, PaymentInfo, TravellerInfo } from '../interface/flight/booking.interface';


export interface IBookingDetails extends Document {
    priceId: string;
    bookingId?: string;
    paymentInfos: PaymentInfo[];
    travellerInfo: TravellerInfo[];
    deliveryInfo: DeliveryInfo;
    contactInfo?: ContactInfo;
    gstInfo?: GSTInfo;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    thirdPartyResponse?: any;
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BookingDetailsSchema = new Schema({
    priceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    bookingId: {
        type: String,
        sparse: true,
        index: true
    },
    paymentInfos: [{
        amount: { type: Number, required: true }
    }],
    travellerInfo: [{
        ti: { type: String, enum: ['Mr', 'Mrs', 'Ms', 'Master'], required: true },
        pt: { type: String, enum: ['ADULT', 'CHILD', 'INFANT'], required: true },
        fN: { type: String, required: true },
        lN: { type: String, required: true },
        dob: { type: String },
        pNum: { type: String },
        eD: { type: String },
        pNat: { type: String },
        pid: { type: String },
        di: { type: String },
        ssrBaggageInfos: [{ key: String, code: String }],
        ssrMealInfos: [{ key: String, code: String }],
        ssrSeatInfos: [{ key: String, code: String }],
        ssrExtraServiceInfos: [{ key: String, code: String }]
    }],
    deliveryInfo: {
        emails: [{ type: String }],
        contacts: [{ type: String }]
    },
    contactInfo: {
        emails: [{ type: String }],
        contacts: [{ type: String }],
        ecn: { type: String }
    },
    gstInfo: {
        gstNumber: { type: String },
        registeredName: { type: String },
        email: { type: String },
        mobile: { type: String },
        address: { type: String }
    },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    },
    thirdPartyResponse: { type: Schema.Types.Mixed },
    errorMessage: { type: String }
}, {
    timestamps: true
});

export const BookingDetails = mongoose.model<IBookingDetails>('BookingDetails', BookingDetailsSchema);