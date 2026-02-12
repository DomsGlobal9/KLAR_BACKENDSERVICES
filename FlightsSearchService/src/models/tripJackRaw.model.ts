import mongoose from "mongoose";

const TripJackRawSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: "TRIPJACK",
      index: true,
    },

    requestPayload: {
      type: Object,
      required: true,
    },

    responsePayload: {
      type: Object,
      required: true,
    },

    searchKey: {
      type: String,
      index: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

export const TripJackRawModel = mongoose.model("tripjack_raw_searches", TripJackRawSchema);
