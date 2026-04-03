import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMarkupEarning extends Document {
  userId: Types.ObjectId;
  bookingId: Types.ObjectId;
  serviceType: string;
  baseAmount: number;
  markupAmount: number;
  type: 'MARKUP_EARNING';
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

const MarkupEarningSchema = new Schema<IMarkupEarning>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  serviceType: { type: String, required: true },
  baseAmount: Number,
  markupAmount: { type: Number, required: true },
  type: { type: String, default: 'MARKUP_EARNING' },
  status: { type: String, enum: ['SUCCESS', 'PENDING', 'FAILED'], default: 'SUCCESS' },
}, { timestamps: true });

MarkupEarningSchema.index({ userId: 1, createdAt: -1 });
MarkupEarningSchema.index({ userId: 1, type: 1, status: 1 });

export const MarkupEarning = mongoose.model<IMarkupEarning>('MarkupEarning', MarkupEarningSchema);