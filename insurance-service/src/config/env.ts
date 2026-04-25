import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

export const env = {
    port: Number(process.env.PORT) || 5014,
    jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",
    mongoUri: process.env.MONGODB_URI || "",

    tripJack: {
        baseUrl: process.env.TRIPJACK_BASE_URL || "https://apitest.tripjack.com",
        apiKey: process.env.TRIPJACK_API_KEY || "",
    },
};

if (!env.tripJack.apiKey) {
    console.error("❌ TRIPJACK_API_KEY is not set. Insurance APIs will fail.");
}
if (!env.mongoUri) {
    console.warn("⚠️  MONGODB_URI not set. Insurance bookings will NOT be persisted.");
}
