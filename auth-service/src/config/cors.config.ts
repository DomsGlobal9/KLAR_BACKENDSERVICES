import { CorsOptions } from 'cors';
import { envConfig } from './env.config';

// Parse CORS origins from comma-separated string to array
const allowedOrigins = envConfig.CORS.CORS_ORIGIN.split(',').map(origin => origin.trim());

export const corsOptions: CorsOptions = {

    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        // Allow localhost and 127.0.0.1 on any port for local development/testing
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === 'http://localhost' || origin === 'http://127.0.0.1') {
            return callback(null, origin);
        }

        /**
         * Allow wild card entry
         */
        if (allowedOrigins.includes('*')) {
            return callback(null, origin);
        }

        /**
         * Allow specific origins
         */
        if (origin && allowedOrigins.includes(origin)) {
            return callback(null, origin);
        }

        /**
         * Production → block
         */
        if (envConfig.NODE_ENV === 'production') {

            return callback(new Error('Not allowed by CORS'));
        }

        // Development → warn but allow

        callback(null, origin);
    },

    methods: envConfig.CORS.CORS_METHODS.split(',').map(m => m.trim()),
    allowedHeaders: envConfig.CORS.CORS_ALLOWED_HEADERS.split(',').map(h => h.trim()),
    credentials: true,
    maxAge: Number(envConfig.CORS.CORS_MAX_AGE),
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};