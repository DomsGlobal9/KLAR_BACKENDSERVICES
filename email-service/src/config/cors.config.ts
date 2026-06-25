import cors from "cors";
import { envConfig } from "./env.config";

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    // Allow localhost and 127.0.0.1 on any port for local development/testing
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === 'http://localhost' || origin === 'http://127.0.0.1') {
      return callback(null, true);
    }

    if (envConfig.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: false,
});