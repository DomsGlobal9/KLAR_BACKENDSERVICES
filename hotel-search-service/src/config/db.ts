import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
  if (!env.mongoUri) {
    console.error(
      "❌ MONGODB_URI is not set. Hotel-name suggestions, popular areas and " +
        "hotel search will be unavailable. Destination suggestions still work.",
    );
    return;
  }

  // A query issued while disconnected is *buffered*, not rejected. The 10s
  // default turns any outage into a 10s hang on every request that touches the
  // database. Fail fast instead; callers guard with isMongoReady().
  mongoose.set("autoIndex", false);
  mongoose.set("bufferTimeoutMS", 2000);

  mongoose.connection.on("disconnected", () =>
    console.error("❌ MongoDB disconnected — DB-backed features are degraded."),
  );
  mongoose.connection.on("reconnected", () => console.log("✅ MongoDB reconnected."));

  console.log("⏳ Connecting to MongoDB...");
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected successfully");
  } catch (error: any) {
    console.error(
      `❌ MongoDB connection failed: ${error.message}\n` +
        "   Express will still start, but DB-backed features are degraded.",
    );
  }
}
