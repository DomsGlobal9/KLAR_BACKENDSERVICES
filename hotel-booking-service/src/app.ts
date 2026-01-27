import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";

dotenv.config();

import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

// Standard middleware
// Standard middleware
app.use(cors());
app.use(express.json());

// Swagger Documentation
console.log("Initializing Swagger UI on /api-docs...");
console.log("swaggerUi.serve is defined:", !!swaggerUi.serve);
console.log("swaggerUi.setup is defined:", !!swaggerUi.setup);
console.log("swaggerSpec is valid object:", typeof swaggerSpec === 'object');

try {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log("Swagger UI initialization successful.");
} catch (err) {
    console.error("Swagger UI initialization FAILED:", err);
}

// Root Endpoint
app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to Hotel Booking Service API",
        healthCheck: "/api/health",
        docs: "/api-docs"
    });
});

// API Routes
app.use("/api", routes);

// Catch-all for 404s to debug
app.use((req, res, next) => {
    console.log(`[404 DEBUG] Unmatched request: ${req.method} ${req.path}`);
    next();
});

// Error Handling
app.use(errorHandler);

export default app;
