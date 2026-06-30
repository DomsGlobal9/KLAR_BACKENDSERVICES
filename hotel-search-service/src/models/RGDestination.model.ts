import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRGDestination extends Document {
  destCode: string;
  destName: string;
}

const rgDestinationSchema = new Schema<IRGDestination>(
  {
    destCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    destName: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Text index for fuzzy destination search
rgDestinationSchema.index({ destName: "text" });

export const RGDestinationModel: Model<IRGDestination> =
  mongoose.models.RGDestination ||
  mongoose.model<IRGDestination>("RGDestination", rgDestinationSchema);
