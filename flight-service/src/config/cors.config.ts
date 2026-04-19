import { CorsOptions } from "cors";
import { envConfig } from "./env.config";

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = envConfig.CORS.ORIGIN;

        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes("*")) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        if (envConfig.NODE_ENV === "production") {
            console.error(`❌ CORS blocked for origin: ${origin}`);
            return callback(new Error("Not allowed by CORS"));
        }

        console.warn(`⚠️ CORS warning: ${origin} not in allowlist`);
        return callback(null, true);
    },

    methods: envConfig.CORS.METHODS,
    allowedHeaders: envConfig.CORS.ALLOWED_HEADERS,
    credentials: envConfig.CORS.CREDENTIALS,
    maxAge: envConfig.CORS.MAX_AGE,

    exposedHeaders: ["X-Total-Count", "X-Page", "X-Per-Page"],
};