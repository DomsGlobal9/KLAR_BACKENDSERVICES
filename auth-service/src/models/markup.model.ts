import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMarkup extends Document {
  userId: Types.ObjectId;
  serviceType: 'FLIGHT' | 'HOTEL' | 'BUS' | 'CAB' | 'PACKAGE' | 'ALL' | string;
  percentageMarkup: number;
  fixedMarkup: number;
  appliedTo?: 'BASE_FARE' | 'TOTAL_FARE' | 'TAXES_ONLY';
  rules?: {
    maxMarkupAmount?: number;
    minBookingAmount?: number;
    maxBookingAmount?: number;
  };
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

const MarkupSchema = new Schema<IMarkup>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  serviceType: { type: String, required: true },
  percentageMarkup: { type: Number, default: 0, min: 0 },
  fixedMarkup: { type: Number, default: 0, min: 0 },
  appliedTo: { type: String, enum: ['BASE_FARE', 'TOTAL_FARE', 'TAXES_ONLY'], default: 'BASE_FARE' },
  rules: {
    maxMarkupAmount: { type: Number, min: 0 },
    minBookingAmount: { type: Number, min: 0 },
    maxBookingAmount: { type: Number, min: 0 },
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Critical indexes for performance
MarkupSchema.index({ userId: 1, serviceType: 1 }, { unique: true });
MarkupSchema.index({ userId: 1, isActive: 1 });

export const Markup = mongoose.model<IMarkup>('Markup', MarkupSchema);