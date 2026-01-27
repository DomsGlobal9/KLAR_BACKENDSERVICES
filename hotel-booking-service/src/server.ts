import app from "./app";

const PORT = 5002;

process.on("uncaughtException", (err) => {
    console.error("FATAL ERROR (uncaughtException):", err);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("FATAL ERROR (unhandledRejection):", reason, "at", promise);
    process.exit(1);
});

console.log(`Starting Hotel Booking Service on port ${PORT}...`);

try {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Hotel Booking Service is fully operational`);
        console.log(`🔗 Local:            http://localhost:${PORT}`);
        console.log(`📃 Documentation:    http://localhost:${PORT}/api-docs`);
    });
} catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
}

