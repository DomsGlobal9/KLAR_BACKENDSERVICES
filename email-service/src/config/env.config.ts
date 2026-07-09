import dotenv from "dotenv";

dotenv.config();

type EnvConfig = {
    PORT: number;
    NODE_ENV: "development" | "production" | "staging";

    CORS_ORIGINS: string[];

    SMTP_HOST: string;
    SMTP_PORT: number;
    SMTP_SECURE: boolean;
    SMTP_USER: string;
    SMTP_PASS: string;

    DEFAULT_FROM: string;
    DEFAULT_FROM_NAME: string;
    DEFAULT_REPLY_TO: string;

    REDIS_URL: string;
};

const requiredEnv = (key: string, value?: string): string => {
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
};

export const envConfig: EnvConfig = {
    PORT: Number(process.env.PORT) || 5000,
    NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",

    CORS_ORIGINS: requiredEnv("CORS_ORIGINS", process.env.CORS_ORIGINS)
        .split(",")
        .map(origin => origin.trim()),

    SMTP_HOST: requiredEnv("SMTP_HOST", process.env.SMTP_HOST),
    SMTP_PORT: Number(process.env.SMTP_PORT || 587),
    SMTP_SECURE: process.env.SMTP_SECURE?.toLowerCase() === "true",
    SMTP_USER: requiredEnv("SMTP_USER", process.env.SMTP_USER),
    SMTP_PASS: requiredEnv("SMTP_PASS", process.env.SMTP_PASS),

    DEFAULT_FROM: requiredEnv("DEFAULT_FROM", process.env.DEFAULT_FROM_EMAIL),
    DEFAULT_FROM_NAME: requiredEnv("DEFAULT_FROM_NAME", process.env.DEFAULT_FROM_NAME),
    DEFAULT_REPLY_TO: requiredEnv("DEFAULT_REPLY_TO", process.env.DEFAULT_REPLY_TO),
    REDIS_URL: requiredEnv("REDIS_URL", process.env.REDIS_URL),
};