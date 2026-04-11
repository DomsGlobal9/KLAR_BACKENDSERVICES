import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

export const env = {
    port: process.env.PORT || 5012,
    jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",
    mongoUri: process.env.MONGODB_URI || "",

    rateGain: {
        baseUrl: process.env.RATEGAIN_BASE_URL!,
        apiKey: process.env.RATEGAIN_API_KEY!,
        apiSecret: process.env.RATEGAIN_SECRET_KEY!,
    },
    tripJack: {
        baseUrl: process.env.TRIPJACK_BASE_URL || "https://apitest-hms.tripjack.com",
        apiKey: process.env.TRIPJACK_API_KEY!,
        agencyId: process.env.TRIPJACK_AGENCY_ID!,
    }
};
if (!env.rateGain.baseUrl) {
    console.error("❌ RATEGAIN_BASE_URL is not set. Service will not work.");
}
if (!env.rateGain.apiKey) {
    console.error("❌ RATEGAIN_API_KEY is not set. Service will not work.");
}
if (!env.tripJack.apiKey) {
    console.warn("⚠️ TRIPJACK_API_KEY is not set. TripJack integration may fail.");
}
