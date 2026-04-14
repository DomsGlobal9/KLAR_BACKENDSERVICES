import { CorsOptions } from 'cors';
import { config } from './env.config';

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        if (config.CORS_ORIGIN.includes('*')) {
            return callback(null, true);
        }

        if (config.CORS_ORIGIN.includes(origin)) {
            return callback(null, true);
        }

        if (config.NODE_ENV === 'production') {
            console.error(`CORS blocked for origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'));
        }

        console.warn(`CORS warning: ${origin} not in allowlist`);
        callback(null, true);
    },

    methods: config.CORS_METHODS,
    allowedHeaders: config.CORS_ALLOWED_HEADERS,
    credentials: config.CORS_CREDENTIALS,
    maxAge: config.CORS_MAX_AGE,
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};