interface EnvConfig {
    PORT: number;
    NODE_ENV: string;

    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;

    CASHFREE_APP_ID: string;
    CASHFREE_SECRET_KEY: string;
    CASHFREE_ENVIRONMENT: 'sandbox' | 'production';

    FRONTEND_URL: string;

    MONGODB_URI: string;
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

    return {
        PORT: port,
        NODE_ENV: process.env.NODE_ENV!,
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,

        CASHFREE_APP_ID: process.env.CASHFREE_APP_ID!,
        CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY!,
        CASHFREE_ENVIRONMENT: cashfreeEnv as 'sandbox' | 'production',

        FRONTEND_URL: process.env.FRONTEND_URL!,

        MONGODB_URI: process.env.MONGODB_URI!,
    };
}

export const config = validateEnv();