import cors, { CorsOptions } from "cors";
import { envConfig } from "./env.config";

const allowedOrigins = envConfig.CORS.ORIGIN;

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },

    methods: envConfig.CORS.METHODS,
    allowedHeaders: envConfig.CORS.ALLOWED_HEADERS,
    credentials: envConfig.CORS.CREDENTIALS,
    maxAge: envConfig.CORS.MAX_AGE,
};

export const corsMiddleware = cors(corsOptions);