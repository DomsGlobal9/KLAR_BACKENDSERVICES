import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHotelData {
  tjHotelId: string;
  name: string;
  cityName: string;
  countryName: string;
  starRating: number;
  address: string;
  location: {
    type: string;
    coordinates: number[];
  };
  images: string[];
  accTypeDesc?: string;
  accMultiDesc?: string;
  accomodationType?: string;
  lastUpdated: Date;
}

export interface IHotel extends IHotelData, Document {}

const hotelSchema = new Schema<IHotel>(
  {
    tjHotelId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    cityName: { type: String, required: true, index: true },
    countryName: { type: String, default: "" },
    starRating: { type: Number, default: 0 },
    address: { type: String, default: "" },
    accTypeDesc: { type: String, default: "" },
    accMultiDesc: { type: String, default: "" },
    accomodationType: { type: String, default: "" },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
      },
    },
    images: { type: [String], default: [] },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

// 2dsphere index for geospatial queries (find hotels near a point, within a city, etc.)
hotelSchema.index({ location: "2dsphere" });

// Text index for fuzzy city search
hotelSchema.index({ cityName: "text", name: "text" });

export const HotelModel: Model<IHotel> =
  mongoose.models.Hotel || mongoose.model<IHotel>("Hotel", hotelSchema);
