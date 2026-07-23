import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

import app from "./app";
import { connectDB } from "./config/db";
import { syncRGDestinations } from "./sync/rgDestinationSync";
import { syncTJHotels } from "./sync/tjHotelSync";
import { startSearchTokenMaintenance } from "./sync/hotelSearchTokensBackfill";
import { buildSuggestionIndex } from "./services/suggestionIndex";
import { startSearchWarmer } from "./sync/searchWarmer";

const PORT = process.env.PORT || 5012;

async function start() {
  // Connect to MongoDB first
  await connectDB();

  // Parse the 8MB city dataset and build the autocomplete index now, while we
  // are still single-user. Deferring it to the first keystroke would cost that
  // user ~1s and block the event loop for every concurrent request.
  buildSuggestionIndex();

  // Seed default popular areas
  try {
    const { seedPopularAreas } = require("./models/PopularArea.model");
    await seedPopularAreas();
  } catch (err: any) {
    console.error("❌ Failed to seed default popular areas:", err.message);
  }

  // Ensures the autocomplete index exists and tops up any hotel missing tokens —
  // whether it predates the field or arrived through a sync that skipped it.
  // Throttled, resumable, and a no-op once the collection is complete.
  startSearchTokenMaintenance();

  if (process.env.ENABLE_AUTO_SYNC === "true") {
    console.log(
      "⏳ Starting background sync processes (RateGain + TripJack)...",
    );
    syncRGDestinations().catch((err) =>
      console.error("❌ [Sync] RG Destinations sync failed:", err.message),
    );
    syncTJHotels().catch((err) =>
      console.error("❌ [Sync] TJ Hotels sync failed:", err.message),
    );
  } else {
    console.log(
      "ℹ️  Background sync disabled (ENABLE_AUTO_SYNC is not 'true'). Set it to 'true' in .env to sync 1.6M hotels.",
    );
  }

  // Pre-builds master result lists for the busiest destination/date combinations
  // so most real searches are served from cache instead of a supplier round-trip.
  startSearchWarmer();

  console.log(`⏳ Attempting to listen on port ${PORT}...`);
  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Hotel Search Service running on http://localhost:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/api/search/health`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
    } else {
      console.error("❌ Server error:", err.message);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // In dev, we might not want to exit, but in prod we usually do.
  // For now, just log it clearly.
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// Graceful shutdown to release the port immediately
const shutdown = () => {
  console.log("⏳ Shutting down server...");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
