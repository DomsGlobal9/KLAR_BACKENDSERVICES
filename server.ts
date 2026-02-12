import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Load environment variables
dotenv.config(); // Try root .env first
dotenv.config({ path: "./hotel-search-service/.env" }); // Then try service-specific .env

// Import routes and shared database client
import mongooseClient from "./shared/db/mongoose.client";
const searchRoutes = require("./hotel-search-service/src/routes").default;
const bookingRoutes = require("./hotel-booking-service/src/routes").default;

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
        "./hotel-booking-service/src/controllers/*.ts",
        "./shared/auth/*.ts"
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

// Mount auth service routes under /api/auth
// import authRoutes from "./shared/auth/auth.routes";
// app.use("/api/auth", authRoutes);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error"
    });
});

// Start unified server
// ... (middleware and routes setup remains unchanged)

// Export Express app for testability/extensibility
export { app };

// Vercel Serverless Function Handler
// This exports a function that ensures DB connection before handling the request
export default async (req: express.Request, res: express.Response) => {
    try {
        await mongooseClient.connect();
        return app(req, res);
    } catch (error) {
        console.error("❌ Vercel Handler Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: (error as Error).message });
    }
};

// Start unified server (Only when run directly, e.g. local dev)
if (require.main === module) {
    async function startServer() {
        try {
            console.log("Connecting to MongoDB...");
            await mongooseClient.connect();

            const PORT = process.env.PORT || 5000;
            app.listen(PORT, () => {
                console.log(`🚀 Klar Hotels Unified API running on http://localhost:${PORT}`);
                console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
            });
        } catch (error) {
            console.error("❌ Failed to start unified server:", error);
            process.exit(1);
        }
    }
    startServer();
}
