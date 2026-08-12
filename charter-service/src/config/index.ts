import { CorsOptions } from "cors";
import { envConfig } from "./env.config";

export * from "./env.config";
export * from "./db.config";

export const corsOptions: CorsOptions = {
  origin: envConfig.CORS_ORIGIN,
  methods: envConfig.CORS_METHODS,
  allowedHeaders: envConfig.CORS_ALLOWED_HEADERS,
  credentials: envConfig.CORS_CREDENTIALS,
  maxAge: envConfig.CORS_MAX_AGE,
};