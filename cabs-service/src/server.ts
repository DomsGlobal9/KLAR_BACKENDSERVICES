import app from "./app";
import { env } from "./config/env";
import mongoose from "mongoose";
import dns from "node:dns/promises";
import { initializeCronJobs } from "./cron";

dns.setServers(["1.1.1.1", "1.0.0.1"]);

const PORT = env.port || 8084;

async function bootstrap() {
    try {
        if (env.mongoUri) {
            console.log("⏳ Connecting to MongoDB...");
            await mongoose.connect(env.mongoUri);
            console.log("✅ MongoDB Connected.");
            initializeCronJobs();
        } else {
            console.warn("⚠️ MONGODB_URI is not set. Persistence is disabled.");
        }
    } catch (error) {
        console.error("❌ MongoDB Connection failed. Persistence is disabled.", error);
    }

    app.listen(PORT, () => {
        console.log(`
    ==================================================
    🚀 Cabs Service is running!
    📡 Port: ${PORT}
    🔗 Health Check: http://localhost:${PORT}/
    📈 TripJack API Domain: ${env.tripJack.baseUrl}
    ==================================================
    `);
    });
}

bootstrap();
