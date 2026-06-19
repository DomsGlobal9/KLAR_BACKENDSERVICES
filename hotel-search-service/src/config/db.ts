import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
    if (!env.mongoUri) {
        console.warn("⚠️  MONGODB_URI not set. MongoDB features will not work.");
        return;
    }

    console.log("⏳ Connecting to MongoDB...");
    try {
        mongoose.set("autoIndex", false);
        await mongoose.connect(env.mongoUri);
        console.log("✅ MongoDB connected successfully");
    } catch (error: any) {
        console.error("❌ MongoDB connection failed:", error.message);
        // Don't exit — still start Express so search can work without DB if needed
    }
}
