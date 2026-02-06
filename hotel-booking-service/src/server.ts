import app from "./app";
import mongooseClient from "../../shared/db/mongoose.client";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5002;

process.on("uncaughtException", (err) => {
    console.error("FATAL ERROR (uncaughtException):", err);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("FATAL ERROR (unhandledRejection):", reason, "at", promise);
    process.exit(1);
});

async function startServer() {
    try {
        console.log(`Starting Hotel Booking Service on port ${PORT}...`);

        // Connect to MongoDB
        await mongooseClient.connect();

        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Hotel Booking Service is fully operational`);
            console.log(`🔗 Local:            http://localhost:${PORT}`);
            console.log(`📃 Documentation:    http://localhost:${PORT}/api-docs`);
            console.log(`🔐 Authentication:   Enabled (JWT)`);
        });

    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
