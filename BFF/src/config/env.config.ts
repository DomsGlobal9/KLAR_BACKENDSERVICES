import dotenv from "dotenv";

dotenv.config();

/**
 * Helper function to fetch env variables safely
 */
function getEnv(key: string, required = true): string {
    const value = process.env[key];

    if (!value && required) {
        throw new Error(`❌ Environment variable "${key}" is missing`);
    }

    return value as string;
}

/**
 * Centralized environment configuration
 */
export const envConfig = {
    NODE_ENV: getEnv("NODE_ENV", false) || "development",

    BASE: {
        PORT: Number(getEnv("PORT", false) || "5000"),
        API_PREFIX: getEnv("API_PREFIX", false) || "/b2b",
    },

    DATABASE: {
        MONGODB_URI: getEnv("MONGODB_URI"),
        DB_NAME: getEnv("MONGODB_DATABASE", false) || "auth-service", // BFF connects to same DB for direct wallet access
    },

    SERVICES: {
        AUTH_SERVICE_URL: getEnv("AUTH_SERVICE_URL", false) || "http://localhost:5010",
        BOOKING_SERVICE_URL: getEnv("BOOKING_SERVICE_URL", false) || "http://localhost:5011",
    },

    JWT: {
        SECRET: getEnv("JWT_SECRET", false) || "your_jwt_secret_key_here_change_in_production",
        REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET", false) || "your_jwt_refresh_secret_key_here_change_in_production",
        EXPIRES_IN: getEnv("JWT_EXPIRES_IN", false) || "7d",
        REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", false) || "7d",
    },

    CORS: {
        ORIGINS: (getEnv("CORS_ORIGIN", false) || "http://localhost:3000").split(","),
    },
};

export const isDevelopment = envConfig.NODE_ENV === "development";
export const isProduction = envConfig.NODE_ENV === "production";
