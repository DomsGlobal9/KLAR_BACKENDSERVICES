import dotenv from "dotenv";

dotenv.config();

type EnvConfig = {
    PORT: number;
    NODE_ENV: "development" | "production" | "test";

    CORS_ORIGIN: string[];
    CORS_METHODS: string[];
    CORS_ALLOWED_HEADERS: string[];
    CORS_CREDENTIALS: boolean;
    CORS_MAX_AGE: number;

    AWS_ACCESS_KEY: string;
    AWS_SECRET_KEY: string;
    AWS_REGION: string;
    AWS_BUCKET_NAME: string;

    EMAIL_DOMAIN: string;
    SES_FROM_EMAIL: string;

    /**
     * Only the URL for the active NODE_ENV is required. Validation lives in
     * supabase.config.ts so database selection has exactly one owner, and so a
     * production host never has to carry development credentials.
     */
    SUPABASE_DEVELOPMENT_DATABASE_URL?: string;
    SUPABASE_PRODUCTION_DATABASE_URL?: string;

    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_PASSWORD?: string;
    REDIS_DB: number;
};

export const requiredEnv = (key: string, value?: string): string => {
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
};

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const;

/**
 * NODE_ENV decides which database this process writes to, so an absent or
 * misspelled value must stop the process rather than fall through to a default.
 * Defaulting here is what lets a production deployment silently write to the
 * development database.
 */
const parseNodeEnv = (value?: string): EnvConfig['NODE_ENV'] => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
        throw new Error(
            `NODE_ENV is not set. Set it explicitly to one of: ${VALID_NODE_ENVS.join(', ')}. ` +
            'Refusing to start with an undefined environment because it determines the target database.'
        );
    }
    if (!(VALID_NODE_ENVS as readonly string[]).includes(normalized)) {
        throw new Error(
            `NODE_ENV="${normalized}" is not valid. Expected one of: ${VALID_NODE_ENVS.join(', ')}.`
        );
    }
    return normalized as EnvConfig['NODE_ENV'];
};

const parseArray = (value?: string): string[] => {
    if (!value) return [];
    return value.split(',').map(item => item.trim());
};

const parseBoolean = (value?: string): boolean => {
    return value?.toLowerCase() === 'true';
};

const parseNumber = (value?: string, defaultValue?: number): number => {
    if (!value) return defaultValue || 0;
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue || 0 : parsed;
};

export const envConfig: EnvConfig = {
    PORT: parseNumber(process.env.PORT, 5012),
    NODE_ENV: parseNodeEnv(process.env.NODE_ENV),

    CORS_ORIGIN: parseArray(process.env.CORS_ORIGIN),
    CORS_METHODS: parseArray(process.env.CORS_METHODS),
    CORS_ALLOWED_HEADERS: parseArray(process.env.CORS_ALLOWED_HEADERS),
    CORS_CREDENTIALS: parseBoolean(process.env.CORS_CREDENTIALS),
    CORS_MAX_AGE: parseNumber(process.env.CORS_MAX_AGE, 86400),

    AWS_ACCESS_KEY: requiredEnv("AWS_ACCESS_KEY", process.env.AWS_ACCESS_KEY),
    AWS_SECRET_KEY: requiredEnv("AWS_SECRET_KEY", process.env.AWS_SECRET_KEY),
    AWS_REGION: requiredEnv("AWS_REGION", process.env.AWS_REGION),
    AWS_BUCKET_NAME: requiredEnv("AWS_BUCKET_NAME", process.env.AWS_BUCKET_NAME),

    EMAIL_DOMAIN: requiredEnv("EMAIL_DOMAIN", process.env.EMAIL_DOMAIN),
    SES_FROM_EMAIL: requiredEnv("SES_FROM_EMAIL", process.env.SES_FROM_EMAIL),

    SUPABASE_DEVELOPMENT_DATABASE_URL: process.env.SUPABASE_DEVELOPMENT_DATABASE_URL,
    SUPABASE_PRODUCTION_DATABASE_URL: process.env.SUPABASE_PRODUCTION_DATABASE_URL,

    REDIS_HOST: process.env.REDIS_HOST || "localhost",
    REDIS_PORT: parseNumber(process.env.REDIS_PORT, 6379),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
    REDIS_DB: parseNumber(process.env.REDIS_DB, 0),
};