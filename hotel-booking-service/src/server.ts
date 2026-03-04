import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import mongoose from "mongoose";
import app from "./app";

const PORT = process.env.PORT || 5013;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
    if (MONGODB_URI) {
        console.log("⏳ Connecting to MongoDB...");
        mongoose.connect(MONGODB_URI)
            .then(() => console.log("✅ MongoDB Connected!"))
            .catch((err) => {
                console.error("⚠️  MongoDB connection failed (bookings will not be persisted locally):", err.message);
            });
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

startServer();
