import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import mongoose from "mongoose";
import app from "./app";
import { env } from "./config/env";
import { startReconciliation } from "./services/reconcile.service";

// D5 — surface what would otherwise be a silent process death.
process.on("unhandledRejection", (reason: any) => {
    console.error("💥 [Insurance] Unhandled promise rejection:", reason?.message || reason);
});
process.on("uncaughtException", (err: any) => {
    console.error("💥 [Insurance] Uncaught exception:", err?.message || err);
    process.exit(1);
});

async function startServer() {
    if (env.mongoUri) {
        console.log("⏳ Connecting to MongoDB...");
        try {
            await mongoose.connect(env.mongoUri);
            console.log("✅ MongoDB Connected — database: insurance-service");
            startReconciliation();
        } catch (err: any) {
            // D2 — serving without persistence means every booking succeeds
            // upstream and is lost locally. Exit so the supervisor retries.
            console.error("❌ MongoDB connection failed:", err.message);
            process.exit(1);
        }
    } else {
        console.warn("⚠️  MONGODB_URI not set. Bookings will NOT be persisted.");
    }

    app.listen(env.port, () => {
        console.log(`\n🛡️  Insurance Service running on http://localhost:${env.port}`);
        console.log(`   GET  /api/insurance/health`);
        console.log(`   POST /api/insurance/search`);
        console.log(`   POST /api/insurance/review`);
        console.log(`   POST /api/insurance/book`);
        console.log(`   POST /api/insurance/booking-details`);
        console.log(`   GET  /api/insurance/bookings`);
        console.log(`   GET  /api/insurance/bookings/:id`);
        console.log(`   POST /api/insurance/amendment/raise`);
        console.log(`   POST /api/insurance/amendment/cancel\n`);
    });
}

startServer();
