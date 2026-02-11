import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { envConfig } from "./src/config/env";
import apiRoutes from "./src/routes/index";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger";
import { errorHandler } from "./src/middlewares/errorHandler";

const app = express();


app.use(cors()); // used to allow cross origin requests
app.use(helmet()); // used to set security headers
app.use(compression()); // used to compress the response
app.use(express.json()); // used to parse the request body

app.get("/check", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to Flights Search Service API"
    });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));



app.use("/api", apiRoutes);

// Handling 404 - Not Found
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Error handler must be last
app.use(errorHandler);

export default app;
