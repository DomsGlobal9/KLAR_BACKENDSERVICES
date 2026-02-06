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
 * All env access MUST go through this object
 */
export const envConfig = {
    NODE_ENV: getEnv("NODE_ENV", false) || "development",

    BASE: {
        PORT: Number(getEnv("PORT", false) || "4000"),
        API_PREFIX: getEnv("API_PREFIX", false) || "/api",
    },

    DATABASE: {
        MONGODB_URI: getEnv("MONGODB_URI"),
        DB_NAME: getEnv("DB_NAME", false) || "your_database_name",
    },

    JWT: {
        SECRET: getEnv("JWT_SECRET", false) || "your_jwt_secret_key_here_change_in_production",
        REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET", false) || "your_jwt_refresh_secret_key_here_change_in_production",
        EXPIRES_IN: getEnv("JWT_EXPIRES_IN", false) || "15m",
        REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", false) || "7d",
    },

    CORS: {
        ORIGINS: (getEnv("CORS_ORIGINS", false) || "http://localhost:3000")
            .split(",")
            .map(origin => origin.trim()),
    },

    COOKIE: {
        SECURE: getEnv("NODE_ENV", false) === "production",
        HTTP_ONLY: true,
        SAME_SITE: getEnv("NODE_ENV", false) === "production" ? "none" as const : "lax" as const,
        MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
    },

};

/**
 * Type definitions for environment configuration
 */
export type EnvConfig = typeof envConfig;

/**
 * Development environment helper
 */
export const isDevelopment = envConfig.NODE_ENV === "development";
export const isProduction = envConfig.NODE_ENV === "production";
export const isTest = envConfig.NODE_ENV === "test";