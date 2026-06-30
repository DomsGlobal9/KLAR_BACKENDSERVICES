import mongoose, { Schema, Document, Model } from "mongoose";

export interface IGeoCache extends Document {
  query: string;
  lat: number;
  lng: number;
  radiusKm: number;
  boundingBox: string[];
}

const geoCacheSchema = new Schema<IGeoCache>(
  {
    query: { type: String, required: true, unique: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusKm: { type: Number, required: true },
    boundingBox: { type: [String], required: true },
  },
  { timestamps: true },
);

export const GeoCacheModel: Model<IGeoCache> =
  mongoose.models.GeoCache ||
  mongoose.model<IGeoCache>("GeoCache", geoCacheSchema);
