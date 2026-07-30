import { Schema, model, Document } from "mongoose";
import { ITourQuery, DestinationType, PortalSource } from "../types/tour.types";

export interface ITourQueryDocument extends ITourQuery, Document {}

const tourQuerySchema = new Schema<ITourQueryDocument>(
  {
    destinationType: {
      type: String,
      enum: Object.values(DestinationType),
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    destinationName: {
      type: String,
      required: true,
      trim: true,
    },
    travelDate: {
      type: Date,
      required: true,
    },
    numberOfTravellers: {
      type: Number,
      required: true,
      min: 1,
    },
    specialRequirements: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      enum: Object.values(PortalSource),
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TourQueryModel = model<ITourQueryDocument>(
  "TourQuery",
  tourQuerySchema,
  "tour_package_service"
);