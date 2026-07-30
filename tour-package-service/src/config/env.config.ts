import dotenv from "dotenv";
dotenv.config();

const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable in .env: "${key}"`);
  }
  return value;
};

export const envConfig = {
  PORT: Number(getEnvVariable("PORT")),
  MONGO_URI: getEnvVariable("MONGO_URI"),
  NODE_ENV: process.env.NODE_ENV || "development",

  CORS: {
    ORIGIN: getEnvVariable("CORS_ORIGIN").split(",").map((item) => item.trim()),
    METHODS: getEnvVariable("CORS_METHODS").split(",").map((item) => item.trim()),
    ALLOWED_HEADERS: getEnvVariable("CORS_ALLOWED_HEADERS").split(",").map((item) => item.trim()),
    CREDENTIALS: process.env.CORS_CREDENTIALS === "true",
    MAX_AGE: process.env.CORS_MAX_AGE ? Number(process.env.CORS_MAX_AGE) : 86400,
  },
};