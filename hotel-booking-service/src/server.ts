import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import app from "./app";

const PORT = process.env.PORT || 5002;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
    try {
        if (MONGODB_URI) {
            console.log("⏳ Connecting to MongoDB...");
            await mongoose.connect(MONGODB_URI);
            console.log("✅ MongoDB Connected!");
        } else {
            console.warn("⚠️ MONGODB_URI not provided. Bookings will NOT be saved.");
        }

        app.listen(PORT, () => {
            console.log(`🚀 Hotel Booking Service running on http://localhost:${PORT}`);
            console.log(`   POST /api/booking/precheck`);
            console.log(`   POST /api/booking/commit`);
            console.log(`   POST /api/booking/cancel`);
            console.log(`   GET  /api/booking/special-requests`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
