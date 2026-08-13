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
     * Uses your existing variables (TRIPJACK_BASE_URL / TRIPJACK_API_KEY) for production.
     * TRIPJACK_PROD_API_KEY is accepted as an alias — several deployed .env files use that
     * name, and without this fallback the apikey header goes out empty (F-01).
     */
    TRIPJACK_PROD: {
        BASE_URL: process.env.TRIPJACK_BASE_URL || "https://api.tripjack.com",
        API_KEY: process.env.TRIPJACK_API_KEY || process.env.TRIPJACK_PROD_API_KEY || "",
    },
};

// Validation checks based on environment
if (isProduction && !env.TRIPJACK_PROD.API_KEY) {
    console.error("❌ Neither TRIPJACK_API_KEY nor TRIPJACK_PROD_API_KEY is set. Insurance APIs will fail.");
} else if (!isProduction && !env.TRIPJACK_TEST.API_KEY) {
    console.error("❌ TRIPJACK_TEST_API_KEY is not set. Insurance APIs will fail.");
}

if (!env.mongoUri) {
    console.warn("⚠️  MONGODB_URI not set. Insurance bookings will NOT be persisted.");
}

// C3 — the fallback secret below is published in this repository. Verifying
// production tokens against it would let anyone mint a valid JWT, so refuse to
// start rather than fail open and silently.
if (isProduction && !process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET is not set. Refusing to start in production with the default secret.");
    process.exit(1);
}