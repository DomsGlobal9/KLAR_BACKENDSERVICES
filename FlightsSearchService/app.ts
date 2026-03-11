import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { envConfig } from "./src/config/env";
import apiRoutes from "./src/routes/index";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger";
import { errorHandler } from "./src/middleware/errorHandler";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = envConfig.CORS.ORIGINS;

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(cookieParser()); // middleware added here