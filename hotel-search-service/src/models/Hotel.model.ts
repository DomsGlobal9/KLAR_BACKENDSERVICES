import mongoose, { Schema, Document, Model } from "mongoose";
import { tokenizeText } from "../utils/text";

/**
 * Lowercased word tokens drawn from the hotel name and its city, used by
 * autocomplete. Querying `{ searchTokens: /^taj/ }` walks a multikey index;
 * the previous `{ name: /taj/i }` could only be answered by scanning all
 * ~1.6M documents.
 *
 * Tokenizing goes through utils/text so that this and the query side strip
 * diacritics the same way. They used to disagree, which made every hotel with an
 * accent in its name unreachable — even by its own exact spelling.
 *
 * Any code that writes a hotel must set this. `bulkWrite` — the only write path
 * today, in tjHotelSync — bypasses Mongoose middleware, so a schema hook would
 * not fire and cannot be relied on. Rows that slip through are repaired by
 * runSearchTokenMaintenance() on the next boot.
 */
export function buildSearchTokens(name: string, cityName: string): string[] {
  return Array.from(new Set(tokenizeText(`${name ?? ""} ${cityName ?? ""}`)));
}

export interface IHotelData {
  tjHotelId: string;
  name: string;
  cityName: string;
  searchTokens?: string[];
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
    searchTokens: { type: [String], default: [] },
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

// Multikey index backing the autocomplete prefix lookup.
hotelSchema.index({ searchTokens: 1 });

// Backs the "top cities in <country>" aggregation behind the landing-page
// destination tiles. Without it that group-by collection-scans all ~1.6M
// documents; with it, only the one country's slice is touched.
hotelSchema.index({ countryName: 1, cityName: 1 });

export const HotelModel: Model<IHotel> =
  mongoose.models.Hotel || mongoose.model<IHotel>("Hotel", hotelSchema);
