interface EnvConfig {
    PORT: number;
    NODE_ENV: string;
    FRONTEND_URL: string;

    MONGODB_URI: string;

    /**
     * B2B Razorpay Credentials
     */
    RAZORPAY_B2B_TEST_KEY_ID: string;
    RAZORPAY_B2B_TEST_KEY_SECRET: string;
    RAZORPAY_B2B_PROD_KEY_ID: string;
    RAZORPAY_B2B_PROD_KEY_SECRET: string;

    /**
     * B2C Razorpay Credentials
     */
    RAZORPAY_B2C_TEST_KEY_ID: string;
    RAZORPAY_B2C_TEST_KEY_SECRET: string;
    RAZORPAY_B2C_PROD_KEY_ID: string;
    RAZORPAY_B2C_PROD_KEY_SECRET: string;

    /**
     * Common Razorpay Settings
     */
    RAZORPAY_ENVIRONMENT: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    RAZORPAY_API_URL: string;

    /**
     * Cashfree Config (keep as is)
     */
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

/**
 * Platform-specific Razorpay configuration interface
 */
export interface RazorpayPlatformConfig {
    keyId: string;
    keySecret: string;
    environment: 'test' | 'live';
}

const requiredEnvVars = [
    'PORT',
    'NODE_ENV',
    'RAZORPAY_B2B_TEST_KEY_ID',
    'RAZORPAY_B2B_TEST_KEY_SECRET',
    'RAZORPAY_B2B_PROD_KEY_ID',
    'RAZORPAY_B2B_PROD_KEY_SECRET',
    'RAZORPAY_B2C_TEST_KEY_ID',
    'RAZORPAY_B2C_TEST_KEY_SECRET',
    'RAZORPAY_B2C_PROD_KEY_ID',
    'RAZORPAY_B2C_PROD_KEY_SECRET',
    'RAZORPAY_ENVIRONMENT',
    'RAZORPAY_WEBHOOK_SECRET',
    'RAZORPAY_API_URL',
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

    const razorpayEnv = process.env.RAZORPAY_ENVIRONMENT!;
    if (!['test', 'live'].includes(razorpayEnv)) {
        throw new Error(`RAZORPAY_ENVIRONMENT must be either 'test' or 'live'`);
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

        /**
         * B2B Credentials
         */
        RAZORPAY_B2B_TEST_KEY_ID: process.env.RAZORPAY_B2B_TEST_KEY_ID!,
        RAZORPAY_B2B_TEST_KEY_SECRET: process.env.RAZORPAY_B2B_TEST_KEY_SECRET!,
        RAZORPAY_B2B_PROD_KEY_ID: process.env.RAZORPAY_B2B_PROD_KEY_ID!,
        RAZORPAY_B2B_PROD_KEY_SECRET: process.env.RAZORPAY_B2B_PROD_KEY_SECRET!,

        /**
         * B2C Credentials
         */
        RAZORPAY_B2C_TEST_KEY_ID: process.env.RAZORPAY_B2C_TEST_KEY_ID!,
        RAZORPAY_B2C_TEST_KEY_SECRET: process.env.RAZORPAY_B2C_TEST_KEY_SECRET!,
        RAZORPAY_B2C_PROD_KEY_ID: process.env.RAZORPAY_B2C_PROD_KEY_ID!,
        RAZORPAY_B2C_PROD_KEY_SECRET: process.env.RAZORPAY_B2C_PROD_KEY_SECRET!,

        /**
         * Shared Razorpay settings (environment and webhook secret) 
         * for both B2B and B2C platforms
         */
        RAZORPAY_ENVIRONMENT: process.env.RAZORPAY_ENVIRONMENT!,
        RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET!,
        RAZORPAY_API_URL: process.env.RAZORPAY_API_URL!,
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

/**
 * Helper function to get Razorpay config based on platform and environment
 * @param platform 
 * @returns 
 */
export function getRazorpayConfig(platform: 'B2B' | 'B2C'): RazorpayPlatformConfig {
    const env = config.RAZORPAY_ENVIRONMENT as 'test' | 'live';

    if (platform === 'B2B') {
        return {
            keyId: env === 'test' ? config.RAZORPAY_B2B_TEST_KEY_ID : config.RAZORPAY_B2B_PROD_KEY_ID,
            keySecret: env === 'test' ? config.RAZORPAY_B2B_TEST_KEY_SECRET : config.RAZORPAY_B2B_PROD_KEY_SECRET,
            environment: env
        };
    } else {
        return {
            keyId: env === 'test' ? config.RAZORPAY_B2C_TEST_KEY_ID : config.RAZORPAY_B2C_PROD_KEY_ID,
            keySecret: env === 'test' ? config.RAZORPAY_B2C_TEST_KEY_SECRET : config.RAZORPAY_B2C_PROD_KEY_SECRET,
            environment: env
        };
    }
}

/**
 * Get webhook secret (SAME for both platforms)
 * @returns 
 */
export function getWebhookSecret(): string {
    return config.RAZORPAY_WEBHOOK_SECRET;
}


















// interface EnvConfig {
//     PORT: number;
//     NODE_ENV: string;
//     FRONTEND_URL: string;

//     MONGODB_URI: string;

//     RAZORPAY_KEY_ID: string;
//     RAZORPAY_KEY_SECRET: string;
//     RAZORPAY_PROD_KEY_ID: string;
//     RAZORPAY_PROD_KEY_SECRET: string;
//     RAZORPAY_ENVIRONMENT: string;
//     RAZORPAY_WEBHOOK_SECRET?: string;

//     CASHFREE_BASE_URL: string;
//     CASHFREE_APP_ID: string;
//     CASHFREE_SECRET_KEY: string;
//     CASHFREE_ENVIRONMENT: 'sandbox' | 'production';

//     CORS_ORIGIN: string;
//     CORS_METHODS: string;
//     CORS_ALLOWED_HEADERS: string;
//     CORS_CREDENTIALS: boolean;
//     CORS_MAX_AGE: number;
// }

// const requiredEnvVars = [
//     'PORT',
//     'NODE_ENV',
//     'RAZORPAY_KEY_ID',
//     'RAZORPAY_KEY_SECRET',
//     'RAZORPAY_PROD_KEY_ID',
//     'RAZORPAY_PROD_KEY_SECRET',
//     'RAZORPAY_ENVIRONMENT',
//     'RAZORPAY_WEBHOOK_SECRET',
//     'CASHFREE_APP_ID',
//     'CASHFREE_SECRET_KEY',
//     'CASHFREE_ENVIRONMENT',
//     'FRONTEND_URL',
//     'MONGODB_URI',
//     'CASHFREE_BASE_URL',
//     'CORS_ORIGIN',
//     'CORS_METHODS',
//     'CORS_ALLOWED_HEADERS',
//     'CORS_CREDENTIALS',
//     'CORS_MAX_AGE',
// ] as const;

// function validateEnv(): EnvConfig {
//     const missingVars: string[] = [];

//     for (const envVar of requiredEnvVars) {
//         if (!process.env[envVar]) {
//             missingVars.push(envVar);
//         }
//     }

//     if (missingVars.length > 0) {
//         throw new Error(
//             `Missing ENV variables:\n${missingVars.join('\n')}`
//         );
//     }

//     const port = Number(process.env.PORT);
//     if (isNaN(port)) throw new Error('PORT must be a number');

//     const validNodeEnv = ['development', 'production', 'test'];
//     if (!validNodeEnv.includes(process.env.NODE_ENV!)) {
//         throw new Error(`NODE_ENV must be one of ${validNodeEnv.join(', ')}`);
//     }

//     const cashfreeEnv = process.env.CASHFREE_ENVIRONMENT!;
//     if (!['sandbox', 'production'].includes(cashfreeEnv)) {
//         throw new Error(`Invalid CASHFREE_ENVIRONMENT`);
//     }

//     const razorpayEnv = process.env.RAZORPAY_ENVIRONMENT!;
//     if (!['test', 'live'].includes(razorpayEnv)) {
//         throw new Error(`RAZORPAY_ENVIRONMENT must be either 'test' or 'live'`);
//     }

//     const corsCredentials = process.env.CORS_CREDENTIALS!;
//     let corsCredentialsBoolean: boolean;

//     if (corsCredentials.toLowerCase() === 'true') {
//         corsCredentialsBoolean = true;
//     } else if (corsCredentials.toLowerCase() === 'false') {
//         corsCredentialsBoolean = false;
//     } else {
//         throw new Error('CORS_CREDENTIALS must be "true" or "false"');
//     }

//     const corsMaxAge = Number(process.env.CORS_MAX_AGE);
//     if (isNaN(corsMaxAge)) {
//         throw new Error('CORS_MAX_AGE must be a number');
//     }

//     return {
//         PORT: port,
//         NODE_ENV: process.env.NODE_ENV!,
//         FRONTEND_URL: process.env.FRONTEND_URL!,

//         MONGODB_URI: process.env.MONGODB_URI!,

//         RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,
//         RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,
//         RAZORPAY_PROD_KEY_ID: process.env.RAZORPAY_PROD_KEY_ID!,
//         RAZORPAY_PROD_KEY_SECRET: process.env.RAZORPAY_PROD_KEY_SECRET!,
//         RAZORPAY_ENVIRONMENT: process.env.RAZORPAY_ENVIRONMENT!,
//         RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET!,

//         CASHFREE_BASE_URL: process.env.CASHFREE_BASE_URL!,
//         CASHFREE_APP_ID: process.env.CASHFREE_APP_ID!,
//         CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY!,
//         CASHFREE_ENVIRONMENT: cashfreeEnv as 'sandbox' | 'production',

//         CORS_ORIGIN: process.env.CORS_ORIGIN!,
//         CORS_METHODS: process.env.CORS_METHODS!,
//         CORS_ALLOWED_HEADERS: process.env.CORS_ALLOWED_HEADERS!,
//         CORS_CREDENTIALS: corsCredentialsBoolean,
//         CORS_MAX_AGE: corsMaxAge,
//     };
// }

// export const config = validateEnv();