import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/config/swagger.config";
import reviewRoutes from "./src/routes/review.routes";

const app = express();
app.use(express.json());

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Flights Review API Docs"
}));

app.use("/api/flights", reviewRoutes);

export default app;
