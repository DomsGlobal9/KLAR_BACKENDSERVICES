// dotenv is loaded by main server.ts before importing this module
// import dotenv from "dotenv";
// dotenv.config();

export const env = {
    port: process.env.PORT || 5002,
    useRateGainMock: process.env.USE_RATEGAIN_MOCK === "true",

    rateGain: {
        baseUrl: process.env.RATEGAIN_BASE_URL!,
        apiKey: process.env.RATEGAIN_API_KEY!,
        apiSecret: process.env.RATEGAIN_SECRET_KEY!,
    },
};

// Validate required environment variables
if (!process.env.RATEGAIN_BASE_URL) {
    console.warn("⚠️  WARNING: RATEGAIN_BASE_URL is not set. RateGain requests will fail.");
}
