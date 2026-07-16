import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

const isProduction = process.env.NODE_ENV === "production";

export const env = {
    port: Number(process.env.PORT) || 5014,
    jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",
    mongoUri: process.env.MONGODB_URI || "",

    /**
     * TripJack TEST Configuration
     */
    TRIPJACK_TEST: {
        BASE_URL: process.env.TRIPJACK_TEST_BASE_URL || "https://apitest.tripjack.com",
        API_KEY: process.env.TRIPJACK_TEST_API_KEY || "",
    },

    /**
     * TripJack PROD Configuration
     * Uses your existing variables (TRIPJACK_BASE_URL / TRIPJACK_API_KEY) for production
     */
    TRIPJACK_PROD: {
        BASE_URL: process.env.TRIPJACK_BASE_URL || "https://api.tripjack.com",
        API_KEY: process.env.TRIPJACK_API_KEY || "",
    },
};

// Validation checks based on environment
if (isProduction && !env.TRIPJACK_PROD.API_KEY) {
    console.error("❌ Production TRIPJACK_API_KEY is not set. Insurance APIs will fail.");
} else if (!isProduction && !env.TRIPJACK_TEST.API_KEY) {
    console.error("❌ Test TRIPJACK_TEST_API_KEY is not set. Insurance APIs will fail.");
}

if (!env.mongoUri) {
    console.warn("⚠️  MONGODB_URI not set. Insurance bookings will NOT be persisted.");
}