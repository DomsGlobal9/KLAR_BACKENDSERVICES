import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { envConfig } from "./src/config/env";
import apiRoutes from "./src/routes/index";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger";
import { errorHandler } from "./src/middleware/errorHandler";
import cookieParser from "cookie-parser";

const app = express();


// app.use(cors()); // used to allow cross origin requests



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
app.use(cookieParser())



app.get("/", (req, res) => {
    res.status(200).json({
        message: "Flight service working fine 🚀",
        status: "ok"
    });
});

app.get("/check", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to Flights Search Service API"
    });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));



app.use("/api", apiRoutes);

/**
 * Handling 404 - Not Found
 */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});


app.use(errorHandler);

export default app;
