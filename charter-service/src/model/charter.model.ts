import { Schema, model, Document } from "mongoose";
import { ICharterBooking } from "../types/charter.types";

export interface ICharterDocument extends ICharterBooking, Document {}

const charterSchema = new Schema<ICharterDocument>(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    departureDateTime: { type: Date, required: true },
    passengers: { type: Number, required: true, min: 1 },
    category: {
      type: String,
      enum: [
        "Private Jets",
        "Helicopter Charter",
        "Corporate Charter",
        "Group Charter",
      ],
      required: true,
    },
    fullName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    source: { type: String, enum: ["b2b", "b2c"], required: true },
  },
  { timestamps: true }
);

export const CharterModel = model<ICharterDocument>("CharterBooking", charterSchema);