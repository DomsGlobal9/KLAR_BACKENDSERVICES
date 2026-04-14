
interface EnvConfig {
    PORT: number;
    NODE_ENV: string;
    FRONTEND_URL: string;

    MONGODB_URI: string;

    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;

    CASHFREE_BASE_URL: string;
    CASHFREE_APP_ID: string;
    CASHFREE_SECRET_KEY: string;
    CASHFREE_ENVIRONMENT: 'sandbox' | 'production';

    CORS_ORIGIN: string;
    CORS_METHODS: string;
    CORS_ALLOWED_HEADERS: string;
    CORS_CREDENTIALS: boolean;
    CORS_MAX_AGE: number;
}

const requiredEnvVars = [
    'PORT',
    'NODE_ENV',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'CASHFREE_APP_ID',
    'CASHFREE_SECRET_KEY',
    'CASHFREE_ENVIRONMENT',
    'FRONTEND_URL',
    'MONGODB_URI',
    'CASHFREE_BASE_URL',
    'CORS_ORIGIN',
    'CORS_METHODS',
    'CORS_ALLOWED_HEADERS',
    'CORS_CREDENTIALS',
    'CORS_MAX_AGE',
] as const;

function validateEnv(): EnvConfig {
    const missingVars: string[] = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    }

    if (missingVars.length > 0) {
        throw new Error(
            `Missing ENV variables:\n${missingVars.join('\n')}`
        );
    }

    const port = Number(process.env.PORT);
    if (isNaN(port)) throw new Error('PORT must be a number');

    const validNodeEnv = ['development', 'production', 'test'];
    if (!validNodeEnv.includes(process.env.NODE_ENV!)) {
        throw new Error(`NODE_ENV must be one of ${validNodeEnv.join(', ')}`);
    }

    const cashfreeEnv = process.env.CASHFREE_ENVIRONMENT!;
    if (!['sandbox', 'production'].includes(cashfreeEnv)) {
        throw new Error(`Invalid CASHFREE_ENVIRONMENT`);
    }


    const corsCredentials = process.env.CORS_CREDENTIALS!;
    let corsCredentialsBoolean: boolean;
    if (corsCredentials.toLowerCase() === 'true') {
        corsCredentialsBoolean = true;
    } else if (corsCredentials.toLowerCase() === 'false') {
        corsCredentialsBoolean = false;
    } else {
        throw new Error('CORS_CREDENTIALS must be "true" or "false"');
    }


    const corsMaxAge = Number(process.env.CORS_MAX_AGE);
    if (isNaN(corsMaxAge)) {
        throw new Error('CORS_MAX_AGE must be a number');
    }

    return {
        PORT: port,
        NODE_ENV: process.env.NODE_ENV!,
        FRONTEND_URL: process.env.FRONTEND_URL!,

        MONGODB_URI: process.env.MONGODB_URI!,

        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,

        CASHFREE_BASE_URL: process.env.CASHFREE_BASE_URL!,
        CASHFREE_APP_ID: process.env.CASHFREE_APP_ID!,
        CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY!,
        CASHFREE_ENVIRONMENT: cashfreeEnv as 'sandbox' | 'production',

        CORS_ORIGIN: process.env.CORS_ORIGIN!,
        CORS_METHODS: process.env.CORS_METHODS!,
        CORS_ALLOWED_HEADERS: process.env.CORS_ALLOWED_HEADERS!,
        CORS_CREDENTIALS: corsCredentialsBoolean,
        CORS_MAX_AGE: corsMaxAge,
    };
}

export const config = validateEnv();