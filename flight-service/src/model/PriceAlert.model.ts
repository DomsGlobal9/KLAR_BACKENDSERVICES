import mongoose, { Schema, Document } from "mongoose";

export interface IPriceAlert extends Document {
  userId?: string;
  userEmail?: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  travelDate: string;
  currentFare: number;
  targetPrice: number;
  directFlightsOnly: boolean;
  cabinClass: string;
  status: "ACTIVE" | "TRIGGERED" | "EXPIRED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
}

const PriceAlertSchema = new Schema<IPriceAlert>(
  {
    userId: { type: String, index: true },
    userEmail: { type: String, index: true },
    origin: { type: String, required: true },
    originCity: { type: String },
    destination: { type: String, required: true },
    destinationCity: { type: String },
    travelDate: { type: String, required: true },
    currentFare: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    directFlightsOnly: { type: Boolean, default: false },
    cabinClass: { type: String, default: "Economy" },
    status: { type: String, enum: ["ACTIVE", "TRIGGERED", "EXPIRED", "CANCELLED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

PriceAlertSchema.index({ origin: 1, destination: 1, travelDate: 1, status: 1 });

export const PriceAlertModel = mongoose.model<IPriceAlert>("PriceAlert", PriceAlertSchema);
