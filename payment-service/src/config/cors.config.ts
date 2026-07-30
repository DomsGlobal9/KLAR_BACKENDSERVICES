import { CorsOptions } from 'cors';
import { config } from './env.config';

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        // Allow localhost and 127.0.0.1 on any port for local development/testing
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === 'http://localhost' || origin === 'http://127.0.0.1') {
            return callback(null, true);
        }

        if (config.CORS_ORIGIN.includes('*')) {
            return callback(null, true);
        }

        if (config.CORS_ORIGIN.includes(origin)) {
            return callback(null, true);
        }

        if (config.NODE_ENV === 'production') {

            return callback(new Error('Not allowed by CORS'));
        }


        callback(null, true);
    },

    methods: config.CORS_METHODS,
    allowedHeaders: config.CORS_ALLOWED_HEADERS,
    credentials: config.CORS_CREDENTIALS,
    maxAge: config.CORS_MAX_AGE,
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
};