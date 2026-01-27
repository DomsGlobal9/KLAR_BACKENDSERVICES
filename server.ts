import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Load environment variables from search service (contains RateGain credentials)
dotenv.config({ path: "./hotel-search-service/.env" });

// Import routes from both services
import searchRoutes from "./hotel-search-service/src/routes";
import bookingRoutes from "./hotel-booking-service/src/routes";

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Swagger configuration for unified API
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Klar Hotels Unified API",
            version: "1.0.0",
            description: "Unified API combining Hotel Search and Booking Services"
        },
        servers: [
            {
                url: "http://localhost:5000",
                description: "Development server"
            }
        ]
    },
    apis: [
        "./hotel-search-service/src/controllers/*.ts",
        "./hotel-booking-service/src/controllers/*.ts"
    ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root endpoint
app.get("/", (_req, res) => {
    res.status(200).json({
        message: "Welcome to Klar Hotels Unified API",
        services: {
            search: "/api/search - Hotel Search Service",
            booking: "/api/booking - Hotel Booking Service"
        },
        healthCheck: "/api/health",
        docs: "/api-docs"
    });
});

// Unified health check
app.get("/api/health", (_req, res) => {
    res.json({
        status: "UP",
        service: "klar-hotels-unified-api",
        timestamp: new Date().toISOString()
    });
});

// Mount search service routes under /api/search
app.use("/api/search", searchRoutes);

// Mount booking service routes under /api/booking  
app.use("/api/booking", bookingRoutes);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error"
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Klar Hotels Unified API running on http://localhost:${PORT}`);
    console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
});
