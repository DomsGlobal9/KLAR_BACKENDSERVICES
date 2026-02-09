import { CorsOptions } from 'cors';
import { envConfig } from './env.config';

// Parse CORS origins from comma-separated string to array
const allowedOrigins = envConfig.CORS.CORS_ORIGIN.split(',').map(origin => origin.trim());

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        /**
         * Allow wild card entry
         */
        if (allowedOrigins.includes('*')) {
            return callback(null, true);
        }

        /**
         * Allow specific origins
         */
        if (origin && allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        /**
         * Production → block
         */
        if (envConfig.NODE_ENV === 'production') {
            console.error(`❌ CORS blocked for origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'));
        }

        // Development → warn but allow
        console.warn(`⚠️ CORS warning: ${origin} not in allowlist`);
        callback(null, true);
    },

    methods: envConfig.CORS.CORS_METHODS.split(',').map(m => m.trim()),
    allowedHeaders: envConfig.CORS.CORS_ALLOWED_HEADERS.split(',').map(h => h.trim()),
    credentials: envConfig.CORS.CORS_CREDENTIALS === 'true',
    maxAge: Number(envConfig.CORS.CORS_MAX_AGE),
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};