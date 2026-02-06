import dotenv from "dotenv";

dotenv.config();

/**
 * Helper function to get environment variables with validation
 */
function getEnv(key: string, required = true): string {
  const value = process.env[key];

  if (!value && required) {
    throw new Error(`❌ Environment variable "${key}" is missing`);
  }

  return value as string;
}

/**
 * Environment configuration object
 */
export const envConfig = {
  NODE_ENV: getEnv("NODE_ENV", false) || "development",

  BASE: {
    PORT: Number(getEnv("PORT", false) || "5001"),
    BASE_URL: getEnv("BASE_URL", false) || "http://localhost:5001/",
  },

  DATABASE: {
    MONGODB_URI: getEnv("MONGODB_URI"),
    DB_NAME: getEnv("DB_NAME", false) || "search_service",
  },

  TRIPJACK: {
    BASE_URL: getEnv("TRIPJACK_BASE_URL"),
    API_KEY: getEnv("TRIPJACK_API_KEY"),
    AGENCY_ID: getEnv("TRIPJACK_AGENCY_ID"),
  },

  REDIS: {
    URL: getEnv("REDIS_URL"),
  },
};

/**
 * Type definitions for environment configuration
 */
export type EnvConfig = typeof envConfig;

/**
 * Development environment helpers
 */
export const isDevelopment = envConfig.NODE_ENV === "development";
export const isProduction = envConfig.NODE_ENV === "production";
export const isTest = envConfig.NODE_ENV === "test";