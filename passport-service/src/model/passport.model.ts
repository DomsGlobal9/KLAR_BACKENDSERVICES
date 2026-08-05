import mongoose, { Schema, Document } from "mongoose";
import { IPassportQuote } from "../types/passport.types";

export interface IPassportQuoteDocument extends IPassportQuote, Document {}

const PassportQuoteSchema: Schema = new Schema(
  {
    source: {
      type: String,
      required: true,
      enum: ["b2b", "b2c"],
      lowercase: true,
      trim: true,
    },
    service: {
      type: String,
      required: true,
      enum: ["New passport", "Renewal", "Reissue", "Police Clearance Certificate"],
    },
    applicant: {
      type: String,
      required: true,
      enum: ["Adult", "Minor"],
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    emailId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IPassportQuoteDocument>(
  "PassportQuote",
  PassportQuoteSchema
);