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
        BASE_URL: getEnv("BASE_URL", false) || "",
    },

    DATABASE: {
        MONGODB_URI: getEnv("MONGODB_URI"),
        DB_NAME: getEnv("MONGODB_DATABASE", false) || "auth-service",
        MONGODB_USER: getEnv("MONGODB_USER", false),
        MONGODB_PASSWORD: getEnv("MONGODB_PASSWORD", false),
        MONGODB_CLUSTER: getEnv("MONGODB_CLUSTER", false),
    },

    JWT: {
        SECRET: getEnv("JWT_SECRET", false) || "your_jwt_secret_key_here_change_in_production",
        REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET", false) || "your_jwt_refresh_secret_key_here_change_in_production",
        EXPIRES_IN: getEnv("JWT_EXPIRES_IN", false) || "7d",
        REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", false) || "7d",
    },

    CORS: {
        CORS_ORIGIN: getEnv("CORS_ORIGIN"),
        CORS_METHODS: getEnv("CORS_METHODS"),
        CORS_ALLOWED_HEADERS: getEnv("CORS_ALLOWED_HEADERS"),
        CORS_CREDENTIALS: getEnv("CORS_CREDENTIALS"),

        CORS_MAX_AGE: getEnv("CORS_MAX_AGE"),

    },

    COOKIE: {
        SECURE: getEnv("NODE_ENV", false) === "production",
        HTTP_ONLY: true,
        SAME_SITE: (getEnv("NODE_ENV", false) === "production" ? "none" : "lax") as "none" | "lax" | "strict",
        MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
    },

    EMAIL: {
        EMAIL_SERVICE_URL: getEnv("EMAIL_BASE_URL"),
    },

    /**
     * The KLAR master logins, which configure platform-wide pricing.
     *
     * A second factor on top of Roles.MASTER: the role alone would make a
     * stolen/mis-seeded MASTER user doc enough to rewrite platform pricing,
     * and that write is invisible to agents by design. Requiring the email to
     * also appear here means promoting a master is a deliberate deploy, not a
     * DB update.
     *
     * Empty (the default) disables master access entirely — fail closed.
     */
    MASTER: {
        EMAILS: (getEnv("MASTER_EMAILS", false) || "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
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