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
    PORT: Number(process.env.PORT),
    BASE_URL: process.env.BASE_URL,

    /**
     * MongoDB
     */
    MONGODB_URI: requiredEnv("MONGODB_URI"),
    DB_NAME: process.env.DB_NAME || "flight_service",

    /**
     * Auth Service
     */
    AUTH_SERVICE: process.env.AUTHENTICATION_SERVICE || "",

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
};