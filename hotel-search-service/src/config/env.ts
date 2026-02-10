import dotenv from "dotenv";
dotenv.config();

console.log("[CONFIG] Loading environment variables...");
console.log(`[CONFIG] RATEGAIN_BASE_URL present: ${!!process.env.RATEGAIN_BASE_URL}`);
if (process.env.RATEGAIN_BASE_URL) {
    console.log(`[CONFIG] RATEGAIN_BASE_URL length: ${process.env.RATEGAIN_BASE_URL.length}`);
}

export const env = {
    port: process.env.PORT || 3001,
    useRateGainMock: process.env.USE_RATEGAIN_MOCK === "true",

    rateGain: {
        baseUrl: process.env.RATEGAIN_BASE_URL!,
        apiKey: process.env.RATEGAIN_API_KEY!,
        apiSecret: process.env.RATEGAIN_SECRET_KEY!,
    },
};
