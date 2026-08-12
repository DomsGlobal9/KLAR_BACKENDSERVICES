import mongoose, { Schema, Document } from 'mongoose';

export interface ICruiseEnquiry extends Document {
    departurePort: string;
    sailMonth: string;
    nights: string;
    fullName: string;
    mobileNumber: string;
    emailId: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
}

const CruiseEnquirySchema = new Schema({
    departurePort: { type: String, required: true },
    sailMonth: { type: String, required: true },
    nights: { type: String, required: true },
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    emailId: { type: String, required: true },
    source: { type: String, default: 'b2c' },
}, { timestamps: true });

export const CruiseEnquiry = mongoose.model<ICruiseEnquiry>('CruiseEnquiry', CruiseEnquirySchema);

export default CruiseEnquiry;
