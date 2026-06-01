// Config reloader trigger - env changes
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0"]);

import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import mongoose from "mongoose";
import app from "./app";
import { bookingsService } from "./services/bookings.service";
import { BookingModel, BookingStatus, BookingProvider } from "./models/Booking.model";

const PORT = process.env.PORT || 5013;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
    if (MONGODB_URI) {
        console.log("⏳ Connecting to MongoDB...");
        try {
            await mongoose.connect(MONGODB_URI);
            console.log("✅ MongoDB Connected!");
            startDailySyncJob();
        } catch (err: any) {
            console.error("❌ MongoDB connection failed:", err.message);
            // Optionally exit if DB is required: process.exit(1);
        }
    } else {
        console.warn("⚠️  MONGODB_URI not set. Bookings will NOT be saved to local DB.");
    }

    app.listen(PORT, () => {
        console.log(`🚀 Hotel Booking Service running on http://localhost:${PORT}`);
        console.log(`   POST /api/booking/precheck`);
        console.log(`   POST /api/booking/commit`);
        console.log(`   POST /api/booking/cancel`);
        console.log(`   GET  /api/booking/special-requests`);
    });
}

function startDailySyncJob() {
    console.log("⏰ [Daily Sync] Initializing periodic status sync for TripJack bookings...");
    // Run sync on startup (after a 10s delay to let server start up peacefully)
    setTimeout(() => runSyncJob(), 10000);

    // Then schedule to run every 24 hours
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    setInterval(() => {
        runSyncJob();
    }, DAY_IN_MS);
}

async function runSyncJob() {
    console.log("⏰ [Daily Sync] Starting check for PENDING or HELD TripJack bookings...");
    try {
        const bookingsToSync = await BookingModel.find({
            status: { $in: [BookingStatus.PENDING, BookingStatus.HELD] },
            provider: BookingProvider.TRIPJACK
        });
        
        console.log(`⏰ [Daily Sync] Found ${bookingsToSync.length} TripJack bookings to sync.`);
        for (const booking of bookingsToSync) {
            const id = booking.confirmationNumber || booking.reservationId;
            if (id) {
                console.log(`⏰ [Daily Sync] Syncing booking status: ${id}`);
                await bookingsService.getBookingById(id);
            }
        }
        console.log("⏰ [Daily Sync] Sync cycle complete.");
    } catch (err: any) {
        console.error("⏰ [Daily Sync] Error in periodic sync cycle:", err.message);
    }
}

startServer();
