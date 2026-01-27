import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";

dotenv.config();

import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.status(200).json({
        message: "Welcome to Hotel Search Service API",
        healthCheck: "/api/health"
    });
});

app.use("/api", routes);
app.use(errorHandler);

export default app;

