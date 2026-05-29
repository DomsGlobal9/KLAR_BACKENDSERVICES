import dotenv from "dotenv";

dotenv.config();

const requiredEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

const optionalEnv = (key: string, defaultValue: any): any => {
    const value = process.env[key];
    if (!value) {
        return defaultValue;
    }
    return value;
};

export const envConfig = {
    NODE_ENV: process.env.NODE_ENV,
    CRON_ENABLED: process.env.CRON_ENABLED,
    PORT: Number(process.env.PORT),
    BASE_URL: process.env.BASE_URL,

    /**
     * MongoDB
     */
    MONGODB_URI: requiredEnv("MONGODB_URI"),
    DB_NAME: process.env.DB_NAME || "flight_service",

    /**
     * TripJack TEST
     */
    TRIPJACK_TEST: {
        BASE_URL: requiredEnv("TRIPJACK_TEST_BASE_URL"),
        API_KEY: requiredEnv("TRIPJACK_TEST_API_KEY"),
    },

    /**
     * TripJack PROD
     */
    TRIPJACK_PROD: {
        BASE_URL: requiredEnv("TRIPJACK_PROD_BASE_URL"),
        API_KEY: requiredEnv("TRIPJACK_PROD_API_KEY"),
    },

    /**
     * Redis
     */
    REDIS_URL: process.env.REDIS_URL || "",

    /**
     * Auth Service
     */
    AUTH_SERVICE: process.env.AUTHENTICATION_SERVICE || "",

    /**
     * Email Service
     */
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || "",

    /**
     * CORS
     */
    CORS: {
        ORIGIN: process.env.CORS_ORIGIN?.split(",") || [],
        METHODS: process.env.CORS_METHODS?.split(",") || [],
        ALLOWED_HEADERS: process.env.CORS_ALLOWED_HEADERS?.split(",") || [],
        CREDENTIALS: process.env.CORS_CREDENTIALS === "true",
        MAX_AGE: Number(process.env.CORS_MAX_AGE) || 0,
    },

    /**
     * Platform Markup Configuration (Your Markup)
     */
    PLATFORM_MARKUP: {
        TYPE: optionalEnv("PLATFORM_MARKUP_TYPE", "FIXED"),
        VALUE: Number(optionalEnv("PLATFORM_MARKUP", 0)),
        ENABLED: optionalEnv("PLATFORM_MARKUP_ENABLED", "false") === "true",
        APPLY_TO: optionalEnv("APPLY_TO", "FLIGHT,HOTEL").split(",").map((item: string) => item.trim()),
        CURRENCY: optionalEnv("CURRENCY", "INR"),
    },
};