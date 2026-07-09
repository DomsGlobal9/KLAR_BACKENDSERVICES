// Config reloader trigger - env changes
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0"]);

import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import mongoose from "mongoose";
import app from "./app";
import { bookingsService } from "./services/bookings.service";
import {
  BookingModel,
  BookingStatus,
  BookingProvider,
} from "./models/Booking.model";
import { initializeCronJobs } from "./cron";

const PORT = process.env.PORT || 5013;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
  if (MONGODB_URI) {
    console.log("⏳ Connecting to MongoDB...");
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("✅ MongoDB Connected!");
      initializeCronJobs();
    } catch (err: any) {
      console.error("❌ MongoDB connection failed:", err.message);
      // Optionally exit if DB is required: process.exit(1);
    }
  } else {
    console.warn(
      "⚠️  MONGODB_URI not set. Bookings will NOT be saved to local DB.",
    );
  }

  app.listen(PORT, () => {
    console.log(`🚀 Hotel Booking Service running on http://localhost:${PORT}`);
    console.log(`   POST /api/booking/precheck`);
    console.log(`   POST /api/booking/commit`);
    console.log(`   POST /api/booking/cancel`);
    console.log(`   GET  /api/booking/special-requests`);
  });
}

startServer();

// touch
