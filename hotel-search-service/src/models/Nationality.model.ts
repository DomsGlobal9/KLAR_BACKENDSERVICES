import mongoose, { Schema, Document } from "mongoose";

export interface INationality extends Document {
  countryName: string;
  dialCode: string;
  countryId: string; // TripJack internal ID (e.g. "106")
  code: string; // ISO 2-letter (e.g. "IN")
  isoCode: string; // ISO 3-letter (e.g. "IND")
  updatedAt: Date;
}

const NationalitySchema: Schema = new Schema({
  countryName: { type: String, required: true },
  dialCode: { type: String },
  countryId: { type: String, required: true, unique: true },
  code: { type: String, required: true, index: true },
  isoCode: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

export const NationalityModel = mongoose.model<INationality>(
  "Nationality",
  NationalitySchema,
);
