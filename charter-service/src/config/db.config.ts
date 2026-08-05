import mongoose from "mongoose";
import { envConfig } from "./env.config";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(envConfig.MONGO_URI);
    console.log("MongoDB connected successfully to charter-service");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};