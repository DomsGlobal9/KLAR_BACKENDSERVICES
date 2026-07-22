import { Schema, model, Document } from 'mongoose';

export interface ITour extends Document {
  title: string;
  destination: string;
  price: number;
  durationDays: number;
  isAvailable: boolean;
  createdAt: Date;
}

const tourSchema = new Schema<ITour>(
  {
    title: { type: String, required: true },
    destination: { type: String, required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const TourModel = model<ITour>('Tour', tourSchema);