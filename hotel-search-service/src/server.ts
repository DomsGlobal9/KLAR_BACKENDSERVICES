import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

import app from "./app";
import { connectDB } from "./config/db";
import { syncRGDestinations } from "./sync/rgDestinationSync";
import { syncTJHotels } from "./sync/tjHotelSync";

const PORT = process.env.PORT || 5012;

async function start() {
    // Connect to MongoDB first
    await connectDB();

    if (process.env.ENABLE_AUTO_SYNC === "true") {
        console.log("⏳ Starting background sync processes...");
        syncRGDestinations().catch((err) =>
            console.error("❌ [Sync] RG Destinations sync failed:", err.message)
        );
        syncTJHotels().catch((err) =>
            console.error("❌ [Sync] TJ Hotels sync failed:", err.message)
        );
    } else {
        console.log("ℹ️  Background sync disabled (ENABLE_AUTO_SYNC is not 'true').");
    }

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
