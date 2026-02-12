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
 * Helper function to get number environment variables
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? Number(value) : defaultValue;
}

/**
 * Environment configuration object
 */
export const envConfig = {
  NODE_ENV: getEnv("NODE_ENV", false) || "development",

  BASE: {
    PORT: getEnvNumber("PORT", 5001),
    BASE_URL: getEnv("BASE_URL", false) || "http://localhost:5397",
  },

  DATABASE: {
    MONGODB_URI: getEnv("MONGODB_URI"),
    DB_NAME: getEnv("DB_NAME", false) || "search_service",
  },

  TRIPJACK: {
    BASE_URL: getEnv("TRIPJACK_BASE_URL"),
    API_KEY: getEnv("TRIPJACK_API_KEY"),
    AGENCY_ID: getEnv("TRIPJACK_AGENCY_ID"),
    TOKEN: getEnv("TRIPJACK_API_KEY", false),
    TIMEOUT: getEnvNumber("TRIPJACK_TIMEOUT", 20000),
    CACHE_TTL: getEnvNumber("TRIPJACK_CACHE_TTL", 300),
    
    // TripJack Endpoints
    ENDPOINTS: {
      AIR_SEARCH_ALL: "/fms/v1/air-search-all",
      FARE_RULE: "/fms/v2/farerule",
      REVIEW: "/fms/v2/review",
      REVALIDATE: "/fms/v2/revalidate",
      FARE_QUOTE: "/fms/v2/farequote",
      BOOKING_CREATE: "/fms/v2/booking-create",
      BOOKING_RETRIEVE: "/fms/v2/booking-retrieve",
    },
    
    // Or use direct URLs if provided
    REVIEW_URL: getEnv("TRIPJACK_REVIEW_URL", false) || null,
    REVALIDATE_URL: getEnv("TRIPJACK_REVALIDATE_URL", false) || null,
  },

  REDIS: {
    URL: getEnv("REDIS_URL"),
    CACHE_TTL: getEnvNumber("TRIPJACK_CACHE_TTL", 300),
  },
};

/**
 * Helper function to get TripJack endpoint URL
 */
export function getTripJackEndpoint(endpointKey: keyof typeof envConfig.TRIPJACK.ENDPOINTS): string {
  const endpoint = envConfig.TRIPJACK.ENDPOINTS[endpointKey];
  
  const directUrlMap: Record<string, string | null> = {
    REVIEW: envConfig.TRIPJACK.REVIEW_URL,
    REVALIDATE: envConfig.TRIPJACK.REVALIDATE_URL,
  };
  
  const directUrl = directUrlMap[endpointKey];
  if (directUrl) {
    return directUrl;
  }
  
  return `${envConfig.TRIPJACK.BASE_URL}${endpoint}`;
}

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