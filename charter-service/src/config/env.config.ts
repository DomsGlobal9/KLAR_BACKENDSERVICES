import dotenv from "dotenv";
dotenv.config();

const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const envConfig = {
  PORT: Number(getEnvVar("PORT")),
  NODE_ENV: getEnvVar("NODE_ENV"),
  MONGO_URI: getEnvVar("MONGO_URI"),

  // CORS Configuration
  CORS_ORIGIN: getEnvVar("CORS_ORIGIN").split(","),
  CORS_METHODS: getEnvVar("CORS_METHODS").split(","),
  CORS_ALLOWED_HEADERS: getEnvVar("CORS_ALLOWED_HEADERS").split(","),
  CORS_CREDENTIALS: getEnvVar("CORS_CREDENTIALS") === "true",
  CORS_MAX_AGE: Number(getEnvVar("CORS_MAX_AGE")),
};